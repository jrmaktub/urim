// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title UrimQuantumMarket (Optimistic Resolution)
 * @notice Multi-scenario market (use 2 scenarios for YES/NO) with optimistic resolution:
 *         - Anyone can propose an outcome after endTime by posting a bond.
 *         - If undisputed for livenessSeconds, it finalizes automatically.
 *         - If disputed, the arbitrator can resolve.
 * @dev   No oracle dependency; fast to demo. Uses bettingToken for both bets and bonds.
 */
contract UrimQuantumMarket is Ownable, ReentrancyGuard {
    // ====== Types ======
    struct Market {
        // core market data
        string question;
        uint256 endTime;
        bool resolved;
        uint8 winningScenario;                  // 0..n-1 when resolved

        // scenarios & balances
        string[] scenarios;                     // e.g., ["Yes","No"]
        uint256[] probabilities;                // optional weights (not used in payouts)
        uint256[] totalSharesPerScenario;       // sum of stakes per scenario
        mapping(address => mapping(uint8 => uint256)) balances; // user -> scenarioIndex -> amount
        mapping(address => bool) hasClaimed;

        // optimistic resolution state
        uint8   proposedOutcome;                // 0..n-1; NO_PROPOSAL when none
        uint64  proposedAt;                     // timestamp of proposal
        address proposer;                       // who proposed
        string  evidenceURI;                    // IPFS/URL with evidence
        bool    disputed;                       // true if disputed during liveness
    }

    // ====== Storage ======
    IERC20  public bettingToken;
    uint256 public marketCount;
    mapping(uint256 => Market) private markets;
    mapping(bytes32 => bool) public marketExists; // prevent duplicate questions

    // protocol params
    address public arbitrator;        // can resolve when disputed
    uint256 public minBond;           // bond size in bettingToken units (e.g., 1e6 for 1 USDC w/6 decimals)
    uint64  public livenessSeconds;   // how long proposals can be disputed

    uint256 public constant MIN_BET_AMOUNT = 1; // set to 1 unit; raise if you want (depends on token decimals)
    uint8   private constant NO_PROPOSAL = type(uint8).max;

    // ====== Events ======
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
        uint8   indexed scenarioIndex,
        uint256 amount
    );

    event OutcomeProposed(uint256 indexed marketId, uint8 outcome, address proposer, string evidenceURI);
    event OutcomeDisputed(uint256 indexed marketId, address disputer);
    event OutcomeFinalized(uint256 indexed marketId, uint8 outcome, bool viaDispute);

    event QuantumClaimed(uint256 indexed marketId, address indexed user, uint256 amount);

    // ====== Constructor ======
    constructor(address _bettingToken) Ownable(msg.sender) {
        require(_bettingToken != address(0), "Invalid token");
        bettingToken = IERC20(_bettingToken);

        // sensible hackathon defaults (adjust later)
        arbitrator = msg.sender;
        minBond = 1_000_000;          // 1 USDC if token has 6 decimals
        livenessSeconds = 12 hours;
    }

    // ====== Admin Setters ======
    function setArbitrator(address a) external onlyOwner { arbitrator = a; }
    function setMinBond(uint256 b) external onlyOwner { minBond = b; }
    function setLiveness(uint64 s) external onlyOwner { livenessSeconds = s; }

    // ====== Create Market ======
    /**
     * @notice Create a new market with N scenarios (for YES/NO use N=2).
     * @param _question        Market question text.
     * @param _scenarios       Scenario labels (len 2..10).
     * @param _probabilities   Optional weights (len == scenarios), not used in payouts.
     * @param _duration        Seconds from now until trading closes.
     */
    function createQuantumMarket(
        string memory _question,
        string[] memory _scenarios,
        uint256[] memory _probabilities,
        uint256 _duration
    ) external onlyOwner returns (uint256) {
        require(_duration > 0, "Duration must be positive");
        uint256 n = _scenarios.length;
        require(n >= 2 && n <= 10, "Scenarios length 2..10");
        require(_probabilities.length == n, "Probabilities length mismatch");

        for (uint256 i = 0; i < n; i++) {
            require(bytes(_scenarios[i]).length > 0, "Empty scenario");
            require(_probabilities[i] > 0, "Weight must be > 0");
        }

        bytes32 qh = keccak256(abi.encodePacked(_question));
        require(!marketExists[qh], "Duplicate question");

        uint256 marketId = marketCount++;
        Market storage m = markets[marketId];

        m.question = _question;
        m.endTime = block.timestamp + _duration;
        m.resolved = false;
        m.winningScenario = 0;

        for (uint256 i = 0; i < n; i++) {
            m.scenarios.push(_scenarios[i]);
            m.probabilities.push(_probabilities[i]);
            m.totalSharesPerScenario.push(0);
        }

        m.proposedOutcome = NO_PROPOSAL;
        m.proposedAt = 0;
        m.proposer = address(0);
        m.evidenceURI = "";
        m.disputed = false;

        marketExists[qh] = true;

        emit QuantumMarketCreated(marketId, _question, _scenarios, _probabilities, m.endTime);
        return marketId;
    }

    // ====== Buy (Stake) ======
    function buyScenarioShares(
        uint256 _marketId,
        uint8   _scenarioIndex,
        uint256 _amount
    ) external nonReentrant {
        Market storage m = _mustMarket(_marketId);
        require(block.timestamp < m.endTime, "Trading ended");
        require(!m.resolved, "Already resolved");
        require(_amount >= MIN_BET_AMOUNT, "Amount too small");
        require(_scenarioIndex < m.scenarios.length, "Bad scenario");

        require(bettingToken.transferFrom(msg.sender, address(this), _amount), "Token xfer failed");

        m.balances[msg.sender][_scenarioIndex] += _amount;
        m.totalSharesPerScenario[_scenarioIndex] += _amount;

        emit ScenarioPurchased(_marketId, msg.sender, _scenarioIndex, _amount);
    }

    // ====== Optimistic Resolution ======
    function proposeOutcome(
        uint256 _marketId,
        uint8   _outcome,
        string calldata _evidenceURI
    ) external nonReentrant {
        Market storage m = _mustMarket(_marketId);
        require(block.timestamp >= m.endTime, "Not ended");
        require(!m.resolved, "Resolved");
        require(_outcome < m.scenarios.length, "Bad outcome");
        require(m.proposedOutcome == NO_PROPOSAL, "Already proposed");
        require(!m.disputed, "Already disputed");

        // take bond
        require(bettingToken.transferFrom(msg.sender, address(this), minBond), "Bond xfer failed");

        m.proposedOutcome = _outcome;
        m.proposedAt = uint64(block.timestamp);
        m.proposer = msg.sender;
        m.evidenceURI = _evidenceURI;

        emit OutcomeProposed(_marketId, _outcome, msg.sender, _evidenceURI);
    }

    function disputeOutcome(uint256 _marketId) external nonReentrant {
        Market storage m = _mustMarket(_marketId);
        require(m.proposedOutcome != NO_PROPOSAL, "No proposal");
        require(!m.resolved, "Resolved");
        require(!m.disputed, "Already disputed");
        require(block.timestamp < m.proposedAt + livenessSeconds, "Too late");

        // 2x bond to discourage spam
        require(bettingToken.transferFrom(msg.sender, address(this), minBond * 2), "Bond2 xfer failed");
        m.disputed = true;

        emit OutcomeDisputed(_marketId, msg.sender);
    }

    function finalizeIfUndisputed(uint256 _marketId) public nonReentrant {
        Market storage m = _mustMarket(_marketId);
        require(!m.resolved, "Resolved");
        require(m.proposedOutcome != NO_PROPOSAL, "No proposal");
        require(!m.disputed, "Disputed");
        require(block.timestamp >= m.proposedAt + livenessSeconds, "Liveness");

        m.winningScenario = m.proposedOutcome;
        m.resolved = true;

        // return proposer bond
        require(bettingToken.transfer(m.proposer, minBond), "Bond return failed");

        emit OutcomeFinalized(_marketId, m.winningScenario, false);
    }

    function arbitratorResolve(uint256 _marketId, uint8 _outcome) external nonReentrant {
        require(msg.sender == arbitrator, "Not arbitrator");
        Market storage m = _mustMarket(_marketId);
        require(m.disputed, "Not disputed");
        require(!m.resolved, "Resolved");
        require(_outcome < m.scenarios.length, "Bad outcome");

        m.winningScenario = _outcome;
        m.resolved = true;

        // Return proposer bond; keep dispute bond as treasury (owner)
        bettingToken.transfer(m.proposer, minBond);
        bettingToken.transfer(owner(), minBond * 2);

        emit OutcomeFinalized(_marketId, _outcome, true);
    }

    // ====== Claim Winnings ======
    function claimWinnings(uint256 _marketId) external nonReentrant {
        Market storage m = _mustMarket(_marketId);
        require(m.resolved, "Not resolved");
        require(!m.hasClaimed[msg.sender], "Already claimed");

        uint8 win = m.winningScenario;
        uint256 userShares = m.balances[msg.sender][win];
        require(userShares > 0, "No winnings");

        // compute totals
        uint256 winningShares = m.totalSharesPerScenario[win];
        require(winningShares > 0, "No winning shares");

        uint256 totalPool = 0;
        for (uint256 i = 0; i < m.totalSharesPerScenario.length; i++) {
            totalPool += m.totalSharesPerScenario[i];
        }
        uint256 losingShares = totalPool - winningShares;

        // payout = principal + proportional share of losing pool
        uint256 winnings = userShares;
        if (losingShares > 0) {
            uint256 rewardRatio = (losingShares * 1e18) / winningShares;
            winnings += (userShares * rewardRatio) / 1e18;
        }

        m.balances[msg.sender][win] = 0;
        m.hasClaimed[msg.sender] = true;

        require(bettingToken.transfer(msg.sender, winnings), "Token xfer failed");

        emit QuantumClaimed(_marketId, msg.sender, winnings);
    }

    // ====== Views / Helpers ======
    function getMarketBasicInfo(uint256 _marketId)
        external
        view
        returns (
            string memory question,
            uint256 endTime,
            bool resolved,
            uint8 winningScenario,
            uint8 scenarioCount,
            bool disputed,
            uint8 proposedOutcome,
            uint64 proposedAt,
            address proposer,
            string memory evidenceURI
        )
    {
        Market storage m = _mustMarket(_marketId);
        return (
            m.question,
            m.endTime,
            m.resolved,
            m.winningScenario,
            uint8(m.scenarios.length),
            m.disputed,
            m.proposedOutcome,
            m.proposedAt,
            m.proposer,
            m.evidenceURI
        );
    }

    function getScenarios(uint256 _marketId) external view returns (string[] memory) {
        Market storage m = _mustMarket(_marketId);
        return m.scenarios;
    }

    function getProbabilities(uint256 _marketId) external view returns (uint256[] memory) {
        Market storage m = _mustMarket(_marketId);
        return m.probabilities;
    }

    function getTotalSharesPerScenario(uint256 _marketId) external view returns (uint256[] memory) {
        Market storage m = _mustMarket(_marketId);
        return m.totalSharesPerScenario;
    }

    function getUserBalances(uint256 _marketId, address _user) external view returns (uint256[] memory) {
        Market storage m = _mustMarket(_marketId);
        uint256 n = m.scenarios.length;
        uint256[] memory userBalances = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            userBalances[i] = m.balances[_user][uint8(i)];
        }
        return userBalances;
    }

    function hasUserClaimed(uint256 _marketId, address _user) external view returns (bool) {
        Market storage m = _mustMarket(_marketId);
        return m.hasClaimed[_user];
    }

    function getAllMarketIds() external view returns (uint256[] memory) {
        uint256[] memory ids = new uint256[](marketCount);
        for (uint256 i = 0; i < marketCount; i++) {
            ids[i] = i;
        }
        return ids;
    }

    // ====== Internal ======
    function _mustMarket(uint256 _marketId) internal view returns (Market storage m) {
        require(_marketId < marketCount, "No market");
        m = markets[_marketId];
        require(bytes(m.question).length > 0, "Corrupt market");
    }
}
