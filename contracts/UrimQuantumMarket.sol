// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IPyth} from "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import {PythStructs} from "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

contract UrimQuantumMarket is Ownable, ReentrancyGuard {
    struct Market {
        string question;
        uint256 endTime;
        bool resolved;
        uint8 winningScenario; // index of winning scenario (0..n-1). Only valid if resolved == true
        string[] scenarios; // scenario descriptions
        uint256[] probabilities; // optional AI-provided probabilities/weights (not used in payouts)
        uint256[] totalSharesPerScenario; // total tokens staked per scenario
        bytes32 priceFeedId;
        // This array defines the upper bound for each scenario.
        // For N scenarios, you need N-1 boundaries.
        // e.g., Scenarios: [<3500, 3500-4000, >4000]. Boundaries: [3500, 4000]
        int64[] scenarioPriceBoundaries;
        mapping(address => mapping(uint8 => uint256)) balances; // user -> scenarioIndex -> amount
        mapping(address => bool) hasClaimed;
    }

    IPyth public pyth;
    IERC20 public bettingToken;
    uint256 public marketCount;
    mapping(uint256 => Market) private markets;
    mapping(bytes32 => bool) public marketExists; // prevent duplicate question markets by hash

    // Events
    event QuantumMarketCreated(
        uint256 indexed marketId,
        string question,
        string[] scenarios,
        uint256[] probabilities,
        uint256 endTime
    );

    event ScenarioPurchased(
        uint256 indexed marketId,
        address indexed buyer,
        uint8 indexed scenarioIndex,
        uint256 amount
    );

    event QuantumMarketResolved(uint256 indexed marketId, uint8 winningScenario);

    event QuantumClaimed(uint256 indexed marketId, address indexed user, uint256 amount);

    constructor(address _bettingToken, address _pythContractAddress) Ownable(msg.sender){
        require(_bettingToken != address(0), "Invalid token address");
        bettingToken = IERC20(_bettingToken);
        pyth = IPyth(_pythContractAddress);
    }

    /**
     * @notice Create a new quantum market with multiple scenarios.
     * @param _question The market question.
     * @param _scenarios Array of scenario descriptions (2..10 items).
     * @param _probabilities Array of probabilities or weights provided by AI (same length as scenarios). Optional semantics — stored only.
     * @param _duration Duration in seconds for trading (must be > 0).
     * @return marketId index of created market
     */
    function createQuantumMarket(
        string memory _question,
        string[] memory _scenarios,
        uint256[] memory _probabilities,
        uint256 _duration,
        bytes32 _priceFeedId,
        int64[] memory _priceBoundaries // for example [3500e8, 4000e8]
    ) external returns (uint256) {
        require(_duration > 0, "Duration must be positive");
        uint256 n = _scenarios.length;
        // require(_priceBoundaries.length == n - 1, "Incorrect number of price Boundaries");
        require(n >= 2 && n <= 10, "Scenarios length must be between 2 and 10");
        require(_probabilities.length == n, "Probabilities length mismatch");

        // Prevent empty scenario strings
        for (uint256 i = 0; i < n; i++) {
            require(bytes(_scenarios[i]).length > 0, "Scenario cannot be empty");
            require(_probabilities[i] > 0, "Probability must be > 0");
        }

        // Prevent duplicate markets with identical question
        bytes32 questionHash = keccak256(abi.encodePacked(_question));
        require(!marketExists[questionHash], "Market with this question already exists");

        uint256 marketId = marketCount++;
        Market storage m = markets[marketId];

        m.question = _question;
        m.endTime = block.timestamp + _duration;
        m.resolved = false;
        m.winningScenario = type(uint8).max; // invalid until resolved
        m.priceFeedId = _priceFeedId;

        // copy arrays into storage
        for (uint256 i = 0; i < n; i++) {
            m.scenarios.push(_scenarios[i]);
            m.probabilities.push(_probabilities[i]);
            m.totalSharesPerScenario.push(0);
        }
        for (uint256 i = 0; i < _priceBoundaries.length; i++) {
            m.scenarioPriceBoundaries.push(_priceBoundaries[i]);
        }


        marketExists[questionHash] = true;

        emit QuantumMarketCreated(marketId, _question, _scenarios, _probabilities, m.endTime);
        return marketId;
    }

    /**
     * @notice Buy shares (stake tokens) on a particular scenario for a market.
     * @param _marketId Market index.
     * @param _scenarioIndex Index of the scenario (0 .. n-1).
     * @param _amount Amount of tokens to stake (PYUSD).
     */
    function buyScenarioShares(
        uint256 _marketId,
        uint8 _scenarioIndex,
        uint256 _amount
    ) external nonReentrant {
        Market storage m = markets[_marketId];
        require(bytes(m.question).length > 0, "Market does not exist");
        require(block.timestamp < m.endTime, "Market trading period has ended");
        require(!m.resolved, "Market already resolved");
        require(_amount > 0, "Amount must be positive");
        require(_scenarioIndex < m.scenarios.length, "Invalid scenario index");

        // Transfer tokens from buyer to contract
        require(
            bettingToken.transferFrom(msg.sender, address(this), _amount),
            "Token transfer failed"
        );

        // update balances
        m.balances[msg.sender][_scenarioIndex] += _amount;
        m.totalSharesPerScenario[_scenarioIndex] += _amount;

        emit ScenarioPurchased(_marketId, msg.sender, _scenarioIndex, _amount);
    }


function resolveQuantumMarket(uint256 _marketId, bytes[] calldata _priceUpdateData) external payable {
        Market storage m = markets[_marketId];
        require(block.timestamp >= m.endTime, "Market hasn't ended yet");
        require(!m.resolved, "Market already resolved");

        // Update Pyth price on-chain
        uint256 fee = pyth.getUpdateFee(_priceUpdateData);
        pyth.updatePriceFeeds{value: fee}(_priceUpdateData);

        // Get the final price
        PythStructs.Price memory currentPrice = pyth.getPriceNoOlderThan(m.priceFeedId, 60);
        require(currentPrice.publishTime >= m.endTime, "Pyth price is too old");

        // Determine the winning scenario by checking which price range the final price falls into
        uint8 winningIndex = 0;
        for (uint8 i = 0; i < m.scenarioPriceBoundaries.length; i++) {
            if (currentPrice.price < m.scenarioPriceBoundaries[i]) {
                winningIndex = i;
                break; // Found the correct bucket
            }
            // If we are in the last loop iteration and still haven't broken, it means the price is in the highest bucket
            if (i == m.scenarioPriceBoundaries.length - 1) {
                winningIndex = i + 1;
            }
        }
        
        m.winningScenario = winningIndex;
        m.resolved = true;
        emit QuantumMarketResolved(_marketId, m.winningScenario);
    }

    /**
     * @notice Claim winnings for a resolved market. Payout =
     *         userShares + userShares * (totalLosingShares / totalWinningShares)
     * @param _marketId Market index.
     */
    function claimWinnings(uint256 _marketId) external nonReentrant {
        Market storage m = markets[_marketId];
        require(bytes(m.question).length > 0, "Market does not exist");
        require(m.resolved, "Market not resolved yet");
        require(!m.hasClaimed[msg.sender], "Already claimed");

        uint8 winIndex = m.winningScenario;
        uint256 userShares = m.balances[msg.sender][winIndex];
        uint256 winningShares = m.totalSharesPerScenario[winIndex];
        require(winningShares > 0, "No winning shares in market");
        require(userShares > 0, "No winnings to claim");

        // zero out user's winning balance to prevent reentrancy double-claim
        m.balances[msg.sender][winIndex] = 0;
        m.hasClaimed[msg.sender] = true;

        // compute total pool and losing shares
        uint256 totalPool = 0;
        for (uint256 i = 0; i < m.totalSharesPerScenario.length; i++) {
            totalPool += m.totalSharesPerScenario[i];
        }
        // losing shares = totalPool - winningShares
        uint256 losingShares = totalPool - winningShares;

        // reward ratio: losingShares / winningShares (with 1e18 precision)
        uint256 rewardRatio = 0;
        if (losingShares > 0) {
            rewardRatio = (losingShares * 1e18) / winningShares;
        }

        uint256 winnings = userShares + (userShares * rewardRatio) / 1e18;

        require(bettingToken.transfer(msg.sender, winnings), "Token transfer failed");

        emit QuantumClaimed(_marketId, msg.sender, winnings);
    }

    // --- View / Getter helpers ---

    function getMarketBasicInfo(uint256 _marketId)
        external
        view
        returns (
            string memory question,
            uint256 endTime,
            bool resolved,
            uint8 winningScenario,
            uint8 scenarioCount
        )
    {
        Market storage m = markets[_marketId];
        require(bytes(m.question).length > 0, "Market does not exist");
        return (m.question, m.endTime, m.resolved, m.winningScenario, uint8(m.scenarios.length));
    }

    function getScenarios(uint256 _marketId) external view returns (string[] memory) {
        Market storage m = markets[_marketId];
        require(bytes(m.question).length > 0, "Market does not exist");
        return m.scenarios;
    }

    function getProbabilities(uint256 _marketId) external view returns (uint256[] memory) {
        Market storage m = markets[_marketId];
        require(bytes(m.question).length > 0, "Market does not exist");
        return m.probabilities;
    }

    function getTotalSharesPerScenario(uint256 _marketId) external view returns (uint256[] memory) {
        Market storage m = markets[_marketId];
        require(bytes(m.question).length > 0, "Market does not exist");
        return m.totalSharesPerScenario;
    }

    function getUserBalances(uint256 _marketId, address _user) external view returns (uint256[] memory) {
        Market storage m = markets[_marketId];
        require(bytes(m.question).length > 0, "Market does not exist");
        uint256 n = m.scenarios.length;
        uint256[] memory userBalances = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            userBalances[i] = m.balances[_user][uint8(i)];
        }
        return userBalances;
    }

    function hasUserClaimed(uint256 _marketId, address _user) external view returns (bool) {
        Market storage m = markets[_marketId];
        require(bytes(m.question).length > 0, "Market does not exist");
        return m.hasClaimed[_user];
    }

    function marketStatus(uint256 _marketId) external view returns (string memory) {
        Market storage m = markets[_marketId];
        require(bytes(m.question).length > 0, "Market does not exist");
        if (m.resolved) {
            return "RESOLVED";
        }
        if (block.timestamp >= m.endTime) {
            return "ENDED";
        }
        return "OPEN";
    }

    function getAllMarketIds() external view returns (uint256[] memory) {
        uint256[] memory allMarketIds = new uint256[](marketCount);
        for (uint256 i = 0; i < marketCount; i++) {
            allMarketIds[i] = i;
        }
        return allMarketIds;
    }
}
