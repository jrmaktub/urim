// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IPyth} from "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import {PythStructs} from "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

contract UrimMarket is Ownable, ReentrancyGuard {
    enum MarketOutcome {
        UNRESOLVED,
        OPTION_A,
        OPTION_B
    }

    enum MarketStatus {
        OPEN,
        ENDED,
        RESOLVED
    }

    struct Market {
        string question;
        uint256 endTime;
        MarketOutcome outcome;
        string optionA; // "Yes, price will be > target"
        string optionB; // "No, price will be <= target"
        uint256 totalOptionAShares;
        uint256 totalOptionBShares;
        bool resolved;
        bytes32 priceFeedId;
        int64 targetPrice; // Pyth prices are in int64, for example: 4000 * 1e18
        mapping(address => uint256) optionASharesBalance;
        mapping(address => uint256) optionBSharesBalance;
        mapping(address => bool) hasClaimed;
    }

    IPyth public pyth;
    IERC20 public bettingToken;
    uint256 public marketCount;
    mapping(uint256 => Market) public markets;
    mapping(bytes32 => bool) public marketExists;

    event MarketCreated(
        uint256 indexed marketId,
        string question,
        string optionA,
        string optionB,
        uint256 endTime
    );

    event SharesPurchased(
        uint256 indexed marketId,
        address indexed buyer,
        bool isOptionA,
        uint256 amount
    );

    event MarketResolved(uint256 indexed marketId, MarketOutcome outcome);

    event Claimed(
        uint256 indexed marketId,
        address indexed user,
        uint256 amount
    );

    function _canSetOwner() internal view virtual returns (bool) {
        return msg.sender == owner();
    }

    constructor(
        address _bettingToken,
        address _pythContractAddress
    ) Ownable(msg.sender) {
        bettingToken = IERC20(_bettingToken);
        pyth = IPyth(_pythContractAddress);
    }

    function createMarket(
        string memory _question,
        string memory _optionA,
        string memory _optionB,
        uint256 _duration,
        bytes32 _priceFeedId,
        int64 _tragetPrice // For example $4000, pass in 400000000000
    ) external returns (uint256) {
        require(msg.sender == owner(), "Only owner can create markets");
        require(_duration > 0, "Duration must be positive");
        require(
            bytes(_optionA).length > 0 && bytes(_optionB).length > 0,
            "Options cannot be empty"
        );

        // --- NEW ---
        // Hash the question and check if a market with this question already exists.
        bytes32 questionHash = keccak256(abi.encodePacked(_question));
        require(
            !marketExists[questionHash],
            "Market with this question already exists"
        );

        uint256 marketId = marketCount++;
        Market storage market = markets[marketId];

        market.question = _question;
        market.optionA = _optionA;
        market.optionB = _optionB;
        market.endTime = block.timestamp + _duration;
        market.outcome = MarketOutcome.UNRESOLVED;
        market.priceFeedId = _priceFeedId;
        market.targetPrice = _tragetPrice;

        marketExists[questionHash] = true;

        emit MarketCreated(
            marketId,
            _question,
            _optionA,
            _optionB,
            market.endTime
        );

        return marketId;
    }

    function buyShares(
        uint256 _marketId,
        bool _isOptionA,
        uint256 _amount
    ) external {
        Market storage market = markets[_marketId];
        require(
            block.timestamp < market.endTime,
            "Market trading period has ended"
        );
        require(!market.resolved, "Market already resolved");
        require(_amount > 0, "Amount must be positive");
        require(
            bettingToken.transferFrom(msg.sender, address(this), _amount),
            "Token transfer failed"
        );

        if (_isOptionA) {
            market.optionASharesBalance[msg.sender] += _amount;
            market.totalOptionAShares += _amount;
        } else {
            market.optionBSharesBalance[msg.sender] += _amount;
            market.totalOptionBShares += _amount;
        }

        emit SharesPurchased(_marketId, msg.sender, _isOptionA, _amount);
    }

    /**
     * @notice Resolves a market using Pyth price data. Can be called by anyone.
     * @param _marketId The ID of the market to resolve.
     * @param _priceUpdateData The signed price data from Pyth's off-chain service.
     */
    function resolveMarket(
        uint256 _marketId,
        bytes[] calldata _priceUpdateData
    ) external payable {
        Market storage market = markets[_marketId];
        require(block.timestamp >= market.endTime, "Market hasn't ended yet");
        require(!market.resolved, "Market already resolved");

        // Pay the fee to Pyth to update the price on-chain
        uint256 fee = pyth.getUpdateFee(_priceUpdateData);
        pyth.updatePriceFeeds{value: fee}(_priceUpdateData);

        // 60 seconds is a safe and standard value for this check.
        PythStructs.Price memory currentPrice = pyth.getPriceNoOlderThan(
            market.priceFeedId,
            60
        );

        require(
            currentPrice.publishTime >= market.endTime,
            "Pyth price is from before the market ended"
        );

        // Resolve outcome based on the Pyth price
        if (currentPrice.price > market.targetPrice) {
            market.outcome = MarketOutcome.OPTION_A; // Option A wins
        } else {
            market.outcome = MarketOutcome.OPTION_B; // Option B wins
        }

        market.resolved = true;
        emit MarketResolved(_marketId, market.outcome);
    }

    function claimWinnings(uint256 _marketId) external nonReentrant {
        Market storage market = markets[_marketId];
        require(market.resolved, "Market not resolved yet");
        require(market.hasClaimed[msg.sender] == false, "Already claimed");

        uint256 userShares;
        uint256 winningShares;
        uint256 losingShares;

        if (market.outcome == MarketOutcome.OPTION_A) {
            userShares = market.optionASharesBalance[msg.sender];
            winningShares = market.totalOptionAShares;
            losingShares = market.totalOptionBShares;
            market.optionASharesBalance[msg.sender] = 0;
        } else if (market.outcome == MarketOutcome.OPTION_B) {
            userShares = market.optionBSharesBalance[msg.sender];
            winningShares = market.totalOptionBShares;
            losingShares = market.totalOptionAShares;
            market.optionBSharesBalance[msg.sender] = 0;
        } else {
            revert("Market outcome is not valid");
        }

        // --- FIX --- Moved this check to after winningShares is assigned.
        require(winningShares > 0, "No Winning Shares");
        require(userShares > 0, "No winnings to claim");

        uint256 rewardRatio = (losingShares * 1e18) / winningShares; // Using 1e18 for precision

        uint256 winnings = userShares + (userShares * rewardRatio) / 1e18;

        market.hasClaimed[msg.sender] = true;

        require(
            bettingToken.transfer(msg.sender, winnings),
            "Token transfer failed"
        );

        emit Claimed(_marketId, msg.sender, winnings);
    }

    function getMarketInfo(
        uint256 _marketId
    )
        external
        view
        returns (
            string memory question,
            string memory optionA,
            string memory optionB,
            uint256 endTime,
            MarketOutcome outcome,
            uint256 totalOptionAShares,
            uint256 totalOptionBShares,
            bool resolved
        )
    {
        Market storage market = markets[_marketId];
        return (
            market.question,
            market.optionA,
            market.optionB,
            market.endTime,
            market.outcome,
            market.totalOptionAShares,
            market.totalOptionBShares,
            market.resolved
        );
    }

    function getSharesBalance(
        uint256 _marketId,
        address _user
    ) external view returns (uint256 optionAShares, uint256 optionBShares) {
        Market storage market = markets[_marketId];
        return (
            market.optionASharesBalance[_user],
            market.optionBSharesBalance[_user]
        );
    }

    function marketStatus(
        uint256 _marketId
    ) public view returns (MarketStatus) {
        Market storage market = markets[_marketId];
        if (market.resolved) {
            return MarketStatus.RESOLVED;
        }
        if (block.timestamp >= market.endTime) {
            return MarketStatus.ENDED;
        }
        return MarketStatus.OPEN;
    }

    function getAllMarketIds() external view returns (uint256[] memory) {
        uint256[] memory allMarketIds = new uint256[](marketCount);
        for (uint256 i = 0; i < marketCount; i++) {
            allMarketIds[i] = i;
        }
        return allMarketIds;
    }
}
