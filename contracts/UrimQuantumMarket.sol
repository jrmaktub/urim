// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title UrimQuantumMarketSimple
 * @notice Minimal, user-generated YES/NO markets without any oracle.
 *         Anyone can create a market, others can bet with USDC (or any ERC20).
 *         Later, optimistic resolution is used (manual proposal + dispute).
 */
contract UrimQuantumMarketSimple is ReentrancyGuard {
    struct Market {
        string question;
        uint256 endTime;
        bool resolved;
        uint8 winningScenario; // 0 = YES, 1 = NO
        uint256[2] totalBets;  // YES / NO totals
        mapping(address => uint256[2]) userBets;
        bool hasClaimed;
        uint8 proposedOutcome;
        uint64 proposedAt;
        address proposer;
        bool disputed;
    }

    IERC20 public immutable bettingToken;
    uint256 public marketCount;
    mapping(uint256 => Market) private markets;

    uint256 public minBond = 1e6; // 1 USDC if 6 decimals
    uint64 public livenessSeconds = 12 hours;
    uint8 private constant NO_PROPOSAL = type(uint8).max;

    event MarketCreated(uint256 indexed id, string question, uint256 endTime);
    event BetPlaced(uint256 indexed id, address indexed user, uint8 side, uint256 amount);
    event OutcomeProposed(uint256 indexed id, uint8 outcome, address proposer);
    event OutcomeFinalized(uint256 indexed id, uint8 outcome);

    constructor(address _token) {
        bettingToken = IERC20(_token);
    }

    // Anyone can create a new market
    function createMarket(string memory _question, uint256 _duration) external returns (uint256) {
        require(_duration > 0, "Bad duration");
        uint256 id = marketCount++;
        Market storage m = markets[id];
        m.question = _question;
        m.endTime = block.timestamp + _duration;
        m.resolved = false;
        m.proposedOutcome = NO_PROPOSAL;
        emit MarketCreated(id, _question, m.endTime);
        return id;
    }

    // Place a bet (0=YES, 1=NO)
    function bet(uint256 id, uint8 side, uint256 amount) external nonReentrant {
        require(side < 2, "Invalid side");
        Market storage m = markets[id];
        require(block.timestamp < m.endTime, "Ended");
        require(!m.resolved, "Resolved");
        require(amount > 0, "Zero amount");

        bettingToken.transferFrom(msg.sender, address(this), amount);
        m.userBets[msg.sender][side] += amount;
        m.totalBets[side] += amount;

        emit BetPlaced(id, msg.sender, side, amount);
    }

    // Optimistic resolution (manual proposal)
    function proposeOutcome(uint256 id, uint8 outcome) external nonReentrant {
        Market storage m = markets[id];
        require(block.timestamp >= m.endTime, "Not ended");
        require(!m.resolved, "Resolved");
        require(outcome < 2, "Invalid");
        require(m.proposedOutcome == NO_PROPOSAL, "Already proposed");
        bettingToken.transferFrom(msg.sender, address(this), minBond);

        m.proposedOutcome = outcome;
        m.proposedAt = uint64(block.timestamp);
        m.proposer = msg.sender;
        emit OutcomeProposed(id, outcome, msg.sender);
    }

    function finalize(uint256 id) external nonReentrant {
        Market storage m = markets[id];
        require(!m.resolved, "Resolved");
        require(m.proposedOutcome != NO_PROPOSAL, "No proposal");
        require(block.timestamp >= m.proposedAt + livenessSeconds, "Still live");
        m.resolved = true;
        m.winningScenario = m.proposedOutcome;
        bettingToken.transfer(m.proposer, minBond);
        emit OutcomeFinalized(id, m.winningScenario);
    }

    function claim(uint256 id) external nonReentrant {
        Market storage m = markets[id];
        require(m.resolved, "Not resolved");
        require(!m.hasClaimed, "Claimed");

        uint8 win = m.winningScenario;
        uint256 userStake = m.userBets[msg.sender][win];
        require(userStake > 0, "No win");
        uint256 totalYes = m.totalBets[0];
        uint256 totalNo = m.totalBets[1];
        uint256 totalPool = totalYes + totalNo;
        uint256 winningPool = win == 0 ? totalYes : totalNo;
        uint256 payout = (userStake * totalPool) / winningPool;

        m.hasClaimed = true;
        bettingToken.transfer(msg.sender, payout);
    }

    // -------- View functions --------
    function getMarket(uint256 id)
        external
        view
        returns (string memory question, uint256 endTime, bool resolved, uint8 winningScenario, uint256 yesTotal, uint256 noTotal)
    {
        Market storage m = markets[id];
        return (m.question, m.endTime, m.resolved, m.winningScenario, m.totalBets[0], m.totalBets[1]);
    }

    function getAllMarketIds() external view returns (uint256[] memory ids) {
        ids = new uint256[](marketCount);
        for (uint256 i = 0; i < marketCount; i++) ids[i] = i;
    }
}
