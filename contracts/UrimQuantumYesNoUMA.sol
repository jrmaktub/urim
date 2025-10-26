// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/*
 URIM Quantum Auto Market — Simplified UMA OOV3 Integration
 ✅ Works on Base Sepolia
 ✅ No Finder / no Whitelist / no admin resolve
 ✅ UMA auto-resolves via optimistic oracle
*/

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@uma/core/contracts/optimistic-oracle-v3/interfaces/OptimisticOracleV3Interface.sol";
import "@uma/core/contracts/optimistic-oracle-v3/interfaces/OptimisticOracleV3CallbackRecipientInterface.sol";

contract UrimQuantumAutoUMA is ReentrancyGuard, OptimisticOracleV3CallbackRecipientInterface {
    using SafeERC20 for IERC20;

    struct Market {
        string question;
        address creator;
        uint256 yesPool;
        uint256 noPool;
        bool resolved;
        bool outcome; // true = YES wins
        bytes32 assertionId;
        mapping(address => uint256) yesBets;
        mapping(address => uint256) noBets;
    }

    mapping(uint256 => Market) public markets;
    uint256 public marketCount;
    IERC20 public immutable collateral; // e.g., USDC or PYUSD
    OptimisticOracleV3Interface public immutable oracle;

    uint64 public constant LIVENESS = 7200; // 2h
    uint256 public constant MIN_BOND = 1e6; // 1 USDC (6 decimals)

    event MarketCreated(uint256 indexed id, string question, bytes32 assertionId);
    event BetPlaced(uint256 indexed id, address indexed user, bool yes, uint256 amount);
    event MarketResolved(uint256 indexed id, bool outcome);
    event Claimed(uint256 indexed id, address indexed user, uint256 payout);

    constructor(address _collateral, address _oracle) {
        collateral = IERC20(_collateral);
        oracle = OptimisticOracleV3Interface(_oracle);
    }

    // Create new market (user types question)
    function createMarket(string memory question) external returns (uint256 id) {
        id = marketCount++;
        Market storage m = markets[id];
        m.question = question;
        m.creator = msg.sender;

        // Create UMA assertion for the question (TRUE means YES wins)
        bytes memory claim = abi.encodePacked(
            "As of market close, the correct outcome for: ",
            question,
            " is YES."
        );
        collateral.safeApprove(address(oracle), MIN_BOND);
        bytes32 assertionId = oracle.assertTruth(
            claim,
            address(this), // asserter
            address(this), // callback
            address(0),
            LIVENESS,
            collateral,
            MIN_BOND,
            oracle.defaultIdentifier(),
            bytes32(0)
        );
        m.assertionId = assertionId;

        emit MarketCreated(id, question, assertionId);
    }

    // Users bet YES or NO
    function bet(uint256 id, bool yes, uint256 amount) external nonReentrant {
        Market storage m = markets[id];
        require(!m.resolved, "Resolved");
        require(amount > 0, "Zero bet");
        collateral.safeTransferFrom(msg.sender, address(this), amount);
        if (yes) {
            m.yesBets[msg.sender] += amount;
            m.yesPool += amount;
        } else {
            m.noBets[msg.sender] += amount;
            m.noPool += amount;
        }
        emit BetPlaced(id, msg.sender, yes, amount);
    }

    // UMA calls this automatically when truth resolves
    function assertionResolvedCallback(bytes32 assertionId, bool assertedTruthfully) external override {
        require(msg.sender == address(oracle), "Not UMA");
        for (uint256 i; i < marketCount; i++) {
            Market storage m = markets[i];
            if (m.assertionId == assertionId) {
                m.resolved = true;
                m.outcome = assertedTruthfully;
                emit MarketResolved(i, assertedTruthfully);
                break;
            }
        }
    }

    function assertionDisputedCallback(bytes32) external override {}

    // Claim winnings automatically after UMA resolution
    function claim(uint256 id) external nonReentrant {
        Market storage m = markets[id];
        require(m.resolved, "Not resolved");
        uint256 payout;
        if (m.outcome && m.yesBets[msg.sender] > 0) {
            payout = (m.yesBets[msg.sender] * (m.yesPool + m.noPool)) / m.yesPool;
            m.yesBets[msg.sender] = 0;
        } else if (!m.outcome && m.noBets[msg.sender] > 0) {
            payout = (m.noBets[msg.sender] * (m.yesPool + m.noPool)) / m.noPool;
            m.noBets[msg.sender] = 0;
        }
        require(payout > 0, "Nothing to claim");
        collateral.safeTransfer(msg.sender, payout);
        emit Claimed(id, msg.sender, payout);
    }
}
