// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// UMA
import "@uma/core/contracts/data-verification-mechanism/interfaces/FinderInterface.sol";
import "@uma/core/contracts/common/implementation/AddressWhitelist.sol";
import "@uma/core/contracts/optimistic-oracle-v3/interfaces/OptimisticOracleV3Interface.sol";
import "@uma/core/contracts/optimistic-oracle-v3/interfaces/OptimisticOracleV3CallbackRecipientInterface.sol";

/**
 * @title UrimQuantumYesNoUMA
 * @notice Pooled YES/NO prediction markets resolved by UMA Optimistic Oracle v3 assertions.
 *         - Users create markets (question + duration)
 *         - Anyone stakes currency on YES(0) or NO(1)
 *         - After endTime, anyone can assert outcome via UMA (posts bond)
 *         - If undisputed during liveness, UMA calls back and market finalizes
 *         - Winners claim pro-rata from the pooled stakes
 *
 * Notes for Base Sepolia:
 *   - DVM & bots may be inactive; call `settleUmaAssertion()` after liveness to trigger UMA settlement.
 *   - Use a UMA-whitelisted test currency (e.g., OOV3 `defaultCurrency()` or test USDC if whitelisted).
 */
contract UrimQuantumYesNoUMA is
    ReentrancyGuard,
    OptimisticOracleV3CallbackRecipientInterface
{
    using SafeERC20 for IERC20;

    // -------- UMA / Currency --------
    FinderInterface public immutable finder;
    OptimisticOracleV3Interface public immutable oo;
    IERC20 public immutable currency;
    bytes32 public immutable defaultIdentifier;
    uint64  public assertionLiveness; // e.g., 7200 (2h) on testnet

    // -------- Market Storage --------
    struct Market {
        // Core
        string  question;
        uint256 endTime;
        bool    resolved;
        uint8   winningSide;            // 0 = YES, 1 = NO (valid when resolved)

        // Pools & user stakes
        uint256[2] total;               // [YES, NO] totals
        mapping(address => uint256[2]) user; // user -> [YES, NO]

        // UMA assertion state
        bytes32 activeAssertionId;      // non-zero when an assertion is live
        uint8   assertedSide;           // 0/1 side asserted as truth
        uint256 reward;                 // optional reward to the truthful asserter
        uint256 requiredBond;           // suggested minimum bond (OOv3 may require more)
    }

    struct AssertMeta {
        uint256 marketId;
        address asserter;
    }

    uint256 public marketCount;
    mapping(uint256 => Market) private markets;
    mapping(bytes32 => AssertMeta) public assertionInfo; // UMA assertionId -> meta

    // -------- Events --------
    event MarketCreated(
        uint256 indexed id,
        string question,
        uint256 endTime,
        uint256 reward,
        uint256 requiredBond
    );

    event BetPlaced(
        uint256 indexed id,
        address indexed user,
        uint8 side,
        uint256 amount
    );

    event OutcomeAsserted(
        uint256 indexed id,
        bytes32 indexed assertionId,
        uint8 assertedSide,
        uint256 bond
    );

    event Resolved(uint256 indexed id, uint8 winningSide);
    event Claimed(uint256 indexed id, address indexed user, uint256 amount);

    // -------- Constructor --------
    constructor(
        address _finder,
        address _currency,
        address _optimisticOracleV3,
        uint64  _assertionLivenessSeconds // e.g., 7200 (2h)
    ) {
        finder = FinderInterface(_finder);

        // Require the currency is on UMA's collateral whitelist (parity with UMA docs)
        AddressWhitelist wl = AddressWhitelist(
            finder.getImplementationAddress(bytes32("CollateralWhitelist"))
        );
        require(wl.isOnWhitelist(_currency), "Currency not UMA-whitelisted");

        currency = IERC20(_currency);
        oo = OptimisticOracleV3Interface(_optimisticOracleV3);
        defaultIdentifier = oo.defaultIdentifier();
        assertionLiveness = _assertionLivenessSeconds;
    }

    // -------- Admin (minimal) --------
    function setAssertionLiveness(uint64 seconds_) external {
        // keep open for hackathon agility, or gate with Ownable in prod
        require(seconds_ >= 300 && seconds_ <= 7 days, "unreasonable");
        assertionLiveness = seconds_;
    }

    // -------- Market Creation --------
    function createMarket(
        string memory _question,
        uint256 _durationSeconds,
        uint256 _reward,        // optional: paid to truthful asserter
        uint256 _requiredBond   // suggested bond (min w.r.t. UMA minBond)
    ) external nonReentrant returns (uint256 id) {
        require(bytes(_question).length > 0, "Empty question");
        require(_durationSeconds > 0, "Bad duration");

        id = marketCount++;
        Market storage m = markets[id];
        m.question = _question;
        m.endTime  = block.timestamp + _durationSeconds;
        m.resolved = false;
        m.winningSide = 0;
        m.activeAssertionId = bytes32(0);
        m.assertedSide = 0;
        m.reward = _reward;
        m.requiredBond = _requiredBond;

        if (_reward > 0) {
            currency.safeTransferFrom(msg.sender, address(this), _reward);
        }

        emit MarketCreated(id, _question, m.endTime, _reward, _requiredBond);
    }

    // -------- Betting --------
    function bet(uint256 id, uint8 side, uint256 amount) external nonReentrant {
        require(side < 2, "Side must be 0/1");
        require(amount > 0, "Zero amount");

        Market storage m = _must(id);
        require(block.timestamp < m.endTime, "Betting closed");
        require(!m.resolved, "Resolved");

        currency.safeTransferFrom(msg.sender, address(this), amount);
        m.user[msg.sender][side] += amount;
        m.total[side] += amount;

        emit BetPlaced(id, msg.sender, side, amount);
    }

    // -------- UMA Assertion --------
    /**
     * @notice Anyone can assert the winning side after endTime.
     * @param id Market id.
     * @param side 0 = YES, 1 = NO.
     * @param bondOverride Optional extra bond; pass 0 to auto-calc minimum.
     * @param evidenceURI Optional evidence for off-chain context (UI only).
     */
    function assertOutcome(
        uint256 id,
        uint8 side,
        uint256 bondOverride,
        string calldata evidenceURI
    ) external nonReentrant returns (bytes32 assertionId) {
        require(side < 2, "Side must be 0/1");
        Market storage m = _must(id);
        require(block.timestamp >= m.endTime, "Too early");
        require(!m.resolved, "Already resolved");
        require(m.activeAssertionId == bytes32(0), "Assertion active");

        // Determine bond: max(requiredBond, oo.getMinimumBond(currency), bondOverride)
        uint256 minBond = oo.getMinimumBond(address(currency));
        uint256 bond = m.requiredBond > minBond ? m.requiredBond : minBond;
        if (bondOverride > bond) bond = bondOverride;

        // Compose UMA claim
        bytes memory claim = abi.encodePacked(
            "As of assertion timestamp ",
            _u2s(block.timestamp),
            ", the described prediction market outcome is: ",
            side == 0 ? "YES" : "NO",
            ". The market description is: ",
            bytes(m.question),
            bytes(evidenceURI).length > 0 ? ". Evidence: " : "",
            bytes(evidenceURI)
        );

        // Post bond and assert truth
        currency.safeTransferFrom(msg.sender, address(this), bond);
        currency.safeApprove(address(oo), bond);

        assertionId = oo.assertTruth(
            claim,
            msg.sender,                // asserter (receives reward if truthful)
            address(this),             // callback recipient
            address(0),                // no sovereign security
            assertionLiveness,         // liveness window
            currency,                  // bond currency
            bond,                      // bond amount
            defaultIdentifier,         // identifier
            bytes32(0)                 // domain
        );

        m.activeAssertionId = assertionId;
        m.assertedSide = side;
        assertionInfo[assertionId] = AssertMeta({marketId: id, asserter: msg.sender});

        emit OutcomeAsserted(id, assertionId, side, bond);
    }

    /**
     * @notice On Base Sepolia there may be no settlement bots — call this after liveness to settle on UMA.
     * @param assertionId UMA assertion id returned by `assertOutcome`.
     */
    function settleUmaAssertion(bytes32 assertionId) external {
        oo.settleAssertion(assertionId);
        // UMA will call `assertionResolvedCallback` below.
    }

    // -------- UMA Callbacks --------
    function assertionResolvedCallback(bytes32 assertionId, bool assertedTruthfully) external {
        require(msg.sender == address(oo), "Only OOv3");
        AssertMeta memory meta = assertionInfo[assertionId];
        Market storage m = markets[meta.marketId];

        // end the active assertion either way
        m.activeAssertionId = bytes32(0);

        if (assertedTruthfully && !m.resolved) {
            m.resolved = true;
            m.winningSide = m.assertedSide;

            if (m.reward > 0) {
                currency.safeTransfer(meta.asserter, m.reward);
                m.reward = 0;
            }
            emit Resolved(meta.marketId, m.winningSide);
        } else {
            // allow re-assertion (clears assertedSide)
            m.assertedSide = 0;
        }

        delete assertionInfo[assertionId];
    }

    function assertionDisputedCallback(bytes32 /*assertionId*/) external { /* no-op */ }

    // -------- Claim Winnings --------
    function claim(uint256 id) external nonReentrant returns (uint256 payout) {
        Market storage m = _must(id);
        require(m.resolved, "Not resolved");

        uint8 win = m.winningSide;
        uint256 userStake = m.user[msg.sender][win];
        require(userStake > 0, "No winnings");

        uint256 winPool  = m.total[win];
        uint256 losePool = m.total[1 - win];
        uint256 totalP   = winPool + losePool;

        payout = (userStake * totalP) / winPool;

        // zero out user positions (one-shot claim)
        m.user[msg.sender][0] = 0;
        m.user[msg.sender][1] = 0;

        currency.safeTransfer(msg.sender, payout);
        emit Claimed(id, msg.sender, payout);
    }

    // -------- Views for the UI --------
    function getMarket(uint256 id)
        external
        view
        returns (
            string memory question,
            uint256 endTime,
            bool resolved,
            uint8 winningSide,
            uint256 yesTotal,
            uint256 noTotal,
            bytes32 activeAssertionId,
            uint8 assertedSide,
            uint256 reward,
            uint256 requiredBond
        )
    {
        Market storage m = markets[id];
        return (
            m.question,
            m.endTime,
            m.resolved,
            m.winningSide,
            m.total[0],
            m.total[1],
            m.activeAssertionId,
            m.assertedSide,
            m.reward,
            m.requiredBond
        );
    }

    function getUserStakes(uint256 id, address user)
        external
        view
        returns (uint256 yes, uint256 no)
    {
        Market storage m = markets[id];
        yes = m.user[user][0];
        no  = m.user[user][1];
    }

    function getAllMarketIds() external view returns (uint256[] memory ids) {
        ids = new uint256[](marketCount);
        for (uint256 i = 0; i < marketCount; i++) ids[i] = i;
    }

    function getAssertionMeta(bytes32 assertionId)
        external
        view
        returns (uint256 marketId, address asserter)
    {
        AssertMeta memory a = assertionInfo[assertionId];
        return (a.marketId, a.asserter);
    }

    // -------- Internals --------
    function _must(uint256 id) internal view returns (Market storage m) {
        require(id < marketCount, "No market");
        m = markets[id];
        require(bytes(m.question).length > 0, "Corrupt market");
    }

    // uint -> bytes (ASCII) for timestamp in claim text
    function _u2s(uint256 x) internal pure returns (bytes memory) {
        if (x == 0) return "0";
        uint256 j = x; uint256 len;
        while (j != 0) { len++; j /= 10; }
        bytes memory b = new bytes(len);
        uint256 k = len;
        while (x != 0) { k--; b[k] = bytes1(uint8(48 + x % 10)); x /= 10; }
        return b;
    }
}

