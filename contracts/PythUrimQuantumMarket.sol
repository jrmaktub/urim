// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IPyth} from "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import {PythStructs} from "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

contract PythUrimQuantumMarket is Ownable, ReentrancyGuard {
    enum MarketOutcome {
        UNRESOLVED,
        OPTION_A,
        OPTION_B
    }

    enum MarketStatus {
        OPEN,
        ENDED,
        RESOLVED,
        CANCELLED
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
        bool cancelled;
        bytes32 priceFeedId;
        int64 targetPrice; // Pyth prices are in int64, for example: 4000 * 1e8
        mapping(address => uint256) optionASharesBalance;
        mapping(address => uint256) optionBSharesBalance;
        mapping(address => bool) hasClaimed;
    }

    IPyth public pyth;
    IERC20 public bettingToken;
    uint256 public marketCount;
    mapping(uint256 => Market) public markets;
    mapping(bytes32 => bool) public marketExists;

    // Constants
    uint256 public constant MIN_BET_AMOUNT = 1e6; // Minimum 0.000001 tokens (assuming 18 decimals)
    uint256 public constant MAX_DURATION = 365 days; // Maximum 1 year
    uint256 public constant MIN_DURATION = 1 hours; // Minimum 1 hour

    event MarketCreated(
        uint256 indexed marketId,
        string question,
        string optionA,
        string optionB,
        uint256 endTime,
        bytes32 priceFeedId,
        int64 targetPrice
    );

    event SharesPurchased(
        uint256 indexed marketId,
        address indexed buyer,
        bool isOptionA,
        uint256 amount
    );

    event MarketResolved(uint256 indexed marketId, MarketOutcome outcome, int64 finalPrice);

    event MarketCancelled(uint256 indexed marketId);

    event Claimed(
        uint256 indexed marketId,
        address indexed user,
        uint256 amount
    );

    event RefundClaimed(
        uint256 indexed marketId,
        address indexed user,
        uint256 amount
    );

    constructor(
        address _bettingToken,
        address _pythContractAddress
    ) Ownable(msg.sender) {
        require(_bettingToken != address(0), "Invalid token address");
        require(_pythContractAddress != address(0), "Invalid Pyth address");
        bettingToken = IERC20(_bettingToken);
        pyth = IPyth(_pythContractAddress);
    }

    /**
     * @notice Creates a new prediction market
     * @param _question The market question
     * @param _optionA Description of option A (price > target)
     * @param _optionB Description of option B (price <= target)
     * @param _duration Duration in seconds for the market
     * @param _priceFeedId Pyth price feed ID
     * @param _targetPrice Target price for comparison (e.g., 4000 * 1e8 for $4000)
     * @return marketId The ID of the created market
     */
    function createMarket(
        string memory _question,
        string memory _optionA,
        string memory _optionB,
        uint256 _duration,
        bytes32 _priceFeedId,
        int64 _targetPrice
    ) external returns (uint256) {
        require(_duration >= MIN_DURATION, "Duration too short");
        require(_duration <= MAX_DURATION, "Duration too long");
        require(
            bytes(_question).length > 0,
            "Question cannot be empty"
        );
        require(
            bytes(_optionA).length > 0 && bytes(_optionB).length > 0,
            "Options cannot be empty"
        );
        require(_priceFeedId != bytes32(0), "Invalid price feed ID");
        require(_targetPrice > 0, "Target price must be positive");

        // Check if a market with this question already exists
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
        market.targetPrice = _targetPrice;
        market.resolved = false;
        market.cancelled = false;

        marketExists[questionHash] = true;

        emit MarketCreated(
            marketId,
            _question,
            _optionA,
            _optionB,
            market.endTime,
            _priceFeedId,
            _targetPrice
        );

        return marketId;
    }

    /**
     * @notice Buy shares for a specific option in a market
     * @param _marketId The market ID
     * @param _isOptionA True for Option A, false for Option B
     * @param _amount Amount of tokens to stake
     */
    function buyShares(
        uint256 _marketId,
        bool _isOptionA,
        uint256 _amount
    ) external nonReentrant {
        Market storage market = markets[_marketId];
        require(_marketId < marketCount, "Market does not exist");
        require(!market.cancelled, "Market is cancelled");
        require(
            block.timestamp < market.endTime,
            "Market trading period has ended"
        );
        require(!market.resolved, "Market already resolved");
        require(_amount >= MIN_BET_AMOUNT, "Amount too small");

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
     * @param _marketId The ID of the market to resolve
     * @param _priceUpdateData The signed price data from Pyth's off-chain service
     */
    function resolveMarket(
        uint256 _marketId,
        bytes[] calldata _priceUpdateData
    ) external payable nonReentrant {
        Market storage market = markets[_marketId];
        require(_marketId < marketCount, "Market does not exist");
        require(!market.cancelled, "Market is cancelled");
        require(block.timestamp >= market.endTime, "Market hasn't ended yet");
        require(!market.resolved, "Market already resolved");

        // Pay the fee to Pyth to update the price on-chain
        uint256 fee = pyth.getUpdateFee(_priceUpdateData);
        require(msg.value >= fee, "Insufficient fee");
        
        pyth.updatePriceFeeds{value: fee}(_priceUpdateData);

        // Refund excess payment
        if (msg.value > fee) {
            payable(msg.sender).transfer(msg.value - fee);
        }

        // Get price with staleness check (60 seconds is standard)
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
        emit MarketResolved(_marketId, market.outcome, currentPrice.price);
    }

    /**
     * @notice Claim winnings from a resolved market
     * @param _marketId The market ID
     */
    function claimWinnings(uint256 _marketId) external nonReentrant {
        Market storage market = markets[_marketId];
        require(_marketId < marketCount, "Market does not exist");
        require(!market.cancelled, "Market is cancelled");
        require(market.resolved, "Market not resolved yet");
        require(!market.hasClaimed[msg.sender], "Already claimed");

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

        require(userShares > 0, "No winnings to claim");
        require(winningShares > 0, "No winning shares");

        market.hasClaimed[msg.sender] = true;

        // Calculate winnings: principal + share of losing pool
        uint256 winnings = userShares;
        
        if (losingShares > 0) {
            // Use safe math to prevent overflow
            // rewardRatio = losingShares / winningShares (with 1e18 precision)
            uint256 rewardRatio = (losingShares * 1e18) / winningShares;
            winnings += (userShares * rewardRatio) / 1e18;
        }
        // If losingShares == 0, user just gets their original stake back

        require(
            bettingToken.transfer(msg.sender, winnings),
            "Token transfer failed"
        );

        emit Claimed(_marketId, msg.sender, winnings);
    }

    /**
     * @notice Cancel a market before any bets are placed (emergency function)
     * @param _marketId The market ID to cancel
     */
    function cancelMarket(uint256 _marketId) external onlyOwner {
        Market storage market = markets[_marketId];
        require(_marketId < marketCount, "Market does not exist");
        require(!market.resolved, "Market already resolved");
        require(!market.cancelled, "Market already cancelled");
        require(
            market.totalOptionAShares == 0 && market.totalOptionBShares == 0,
            "Cannot cancel market with existing bets"
        );

        market.cancelled = true;
        
        // Remove from market exists mapping to allow recreation
        bytes32 questionHash = keccak256(abi.encodePacked(market.question));
        marketExists[questionHash] = false;

        emit MarketCancelled(_marketId);
    }

    /**
     * @notice Claim refund from a cancelled market
     * @param _marketId The market ID
     */
    function claimRefund(uint256 _marketId) external nonReentrant {
        Market storage market = markets[_marketId];
        require(_marketId < marketCount, "Market does not exist");
        require(market.cancelled, "Market is not cancelled");
        require(!market.hasClaimed[msg.sender], "Already claimed");

        uint256 optionAShares = market.optionASharesBalance[msg.sender];
        uint256 optionBShares = market.optionBSharesBalance[msg.sender];
        uint256 totalRefund = optionAShares + optionBShares;

        require(totalRefund > 0, "No funds to refund");

        market.optionASharesBalance[msg.sender] = 0;
        market.optionBSharesBalance[msg.sender] = 0;
        market.hasClaimed[msg.sender] = true;

        require(
            bettingToken.transfer(msg.sender, totalRefund),
            "Token transfer failed"
        );

        emit RefundClaimed(_marketId, msg.sender, totalRefund);
    }

    // --- View Functions ---

    /**
     * @notice Get comprehensive market information
     */
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
            bool resolved,
            bool cancelled,
            bytes32 priceFeedId,
            int64 targetPrice
        )
    {
        require(_marketId < marketCount, "Market does not exist");
        Market storage market = markets[_marketId];
        return (
            market.question,
            market.optionA,
            market.optionB,
            market.endTime,
            market.outcome,
            market.totalOptionAShares,
            market.totalOptionBShares,
            market.resolved,
            market.cancelled,
            market.priceFeedId,
            market.targetPrice
        );
    }

    /**
     * @notice Get user's share balance for a market
     */
    function getSharesBalance(
        uint256 _marketId,
        address _user
    ) external view returns (uint256 optionAShares, uint256 optionBShares) {
        require(_marketId < marketCount, "Market does not exist");
        Market storage market = markets[_marketId];
        return (
            market.optionASharesBalance[_user],
            market.optionBSharesBalance[_user]
        );
    }

    /**
     * @notice Get the current status of a market
     */
    function marketStatus(
        uint256 _marketId
    ) public view returns (MarketStatus) {
        require(_marketId < marketCount, "Market does not exist");
        Market storage market = markets[_marketId];
        
        if (market.cancelled) {
            return MarketStatus.CANCELLED;
        }
        if (market.resolved) {
            return MarketStatus.RESOLVED;
        }
        if (block.timestamp >= market.endTime) {
            return MarketStatus.ENDED;
        }
        return MarketStatus.OPEN;
    }

    /**
     * @notice Check if a user has claimed from a market
     */
    function hasUserClaimed(uint256 _marketId, address _user) external view returns (bool) {
        require(_marketId < marketCount, "Market does not exist");
        return markets[_marketId].hasClaimed[_user];
    }

    /**
     * @notice Get all market IDs
     */
    function getAllMarketIds() external view returns (uint256[] memory) {
        uint256[] memory allMarketIds = new uint256[](marketCount);
        for (uint256 i = 0; i < marketCount; i++) {
            allMarketIds[i] = i;
        }
        return allMarketIds;
    }

    /**
     * @notice Calculate potential winnings for a user (before resolution)
     * @param _marketId The market ID
     * @param _user The user address
     * @param _assumeOptionAWins True to calculate if Option A wins, false for Option B
     */
    function calculatePotentialWinnings(
        uint256 _marketId,
        address _user,
        bool _assumeOptionAWins
    ) external view returns (uint256) {
        require(_marketId < marketCount, "Market does not exist");
        Market storage market = markets[_marketId];
        require(!market.resolved, "Market already resolved");

        uint256 userShares;
        uint256 winningShares;
        uint256 losingShares;

        if (_assumeOptionAWins) {
            userShares = market.optionASharesBalance[_user];
            winningShares = market.totalOptionAShares;
            losingShares = market.totalOptionBShares;
        } else {
            userShares = market.optionBSharesBalance[_user];
            winningShares = market.totalOptionBShares;
            losingShares = market.totalOptionAShares;
        }

        if (userShares == 0 || winningShares == 0) {
            return 0;
        }

        uint256 winnings = userShares;
        if (losingShares > 0) {
            uint256 rewardRatio = (losingShares * 1e18) / winningShares;
            winnings += (userShares * rewardRatio) / 1e18;
        }

        return winnings;
    }
}