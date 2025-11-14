// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {VRFConsumerBaseV2Plus} from "@chainlink/contracts@1.5.0/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts@1.5.0/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract FiftyFiftyRaffle is VRFConsumerBaseV2Plus, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public constant USDC = IERC20(0x036CbD53842c5426634e7929541eC2318f3dCF7e);
    IERC20 public constant URIM = IERC20(0xc0d6B202BfedCa279630F03995576667CF6e6C19);
    
    uint256 public s_subscriptionId;
    bytes32 public keyHash = 0x9e1344a1247c8a1785d0a4681a27152bffdb43666ae5bf7d14d24a5efd44bf71;
    uint32 public callbackGasLimit = 300_000;
    uint16 public requestConfirmations = 3;
    uint32 public numWords = 1;
    
    uint256 public constant TICKET_PRICE_USDC = 1e6;
    uint256 public constant TICKET_PRICE_URIM = 900000;
    uint256 public constant ROUND_DURATION = 12 minutes;
    
    uint256 public currentRoundId;
    uint256 public currentRoundEndTime;
    address[] public currentRoundPlayers;
    uint256 public currentRoundTotalUSDC;
    uint256 public currentRoundTotalURIM;
    
    enum RoundState { OPEN, DRAWING, FINISHED }
    RoundState public roundState;
    
    struct RoundResult {
        address winner;
        uint256 totalPotUSDC;
        uint256 totalPotURIM;
        uint256 winnerPayoutUSDC;
        uint256 winnerPayoutURIM;
        uint256 timestamp;
    }
    mapping(uint256 => RoundResult) public roundResults;
    mapping(uint256 => uint256) private vrfRequestToRound;

    event RoundStarted(uint256 indexed roundId, uint256 endTime);
    event TicketPurchased(address indexed player, uint256 indexed roundId);
    event DrawInitiated(uint256 indexed roundId, uint256 requestId);
    event WinnerSelected(uint256 indexed roundId, address indexed winner, uint256 payoutUSDC, uint256 payoutURIM);
    event EmergencyWithdraw(address token, uint256 amount);
    event ManualWinnerSelected(uint256 indexed roundId, address indexed winner);

    constructor(uint256 subscriptionId) VRFConsumerBaseV2Plus(0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE) {
        s_subscriptionId = subscriptionId;
        _startNewRound();
    }

    function buyTicketWithUSDC() external nonReentrant {
        require(roundState == RoundState.OPEN, "Round not open");
        require(block.timestamp < currentRoundEndTime, "Round ended");
        
        USDC.safeTransferFrom(msg.sender, address(this), TICKET_PRICE_USDC);
        currentRoundPlayers.push(msg.sender);
        currentRoundTotalUSDC += TICKET_PRICE_USDC;
        
        emit TicketPurchased(msg.sender, currentRoundId);
    }

    function buyTicketWithURIM() external nonReentrant {
        require(roundState == RoundState.OPEN, "Round not open");
        require(block.timestamp < currentRoundEndTime, "Round ended");
        
        URIM.safeTransferFrom(msg.sender, address(this), TICKET_PRICE_URIM);
        currentRoundPlayers.push(msg.sender);
        currentRoundTotalURIM += TICKET_PRICE_URIM;
        
        emit TicketPurchased(msg.sender, currentRoundId);
    }

    function drawWinner() external onlyOwner returns (uint256 requestId) {
        require(block.timestamp >= currentRoundEndTime, "Round not ended");
        require(currentRoundPlayers.length > 0, "No players");
        require(roundState == RoundState.OPEN, "Already drawing");
        
        roundState = RoundState.DRAWING;
        
        requestId = s_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: keyHash,
                subId: s_subscriptionId,
                requestConfirmations: requestConfirmations,
                callbackGasLimit: callbackGasLimit,
                numWords: numWords,
                extraArgs: VRFV2PlusClient._argsToBytes(VRFV2PlusClient.ExtraArgsV1({nativePayment: false}))
            })
        );
        
        vrfRequestToRound[requestId] = currentRoundId;
        emit DrawInitiated(currentRoundId, requestId);
        return requestId;
    }

    function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) internal override {
        uint256 roundId = vrfRequestToRound[requestId];
        require(roundId > 0, "Invalid request");
        
        _selectWinner(randomWords[0]);
    }

    function _selectWinner(uint256 randomNumber) internal {
        uint256 winnerIndex = randomNumber % currentRoundPlayers.length;
        address winner = currentRoundPlayers[winnerIndex];
        
        uint256 totalUSDC = currentRoundTotalUSDC;
        uint256 totalURIM = currentRoundTotalURIM;
        
        uint256 winnerUSDC = totalUSDC / 2;
        uint256 winnerURIM = totalURIM / 2;
        uint256 projectUSDC = totalUSDC - winnerUSDC;
        uint256 projectURIM = totalURIM - winnerURIM;
        
        if (winnerUSDC > 0) {
            USDC.safeTransfer(winner, winnerUSDC);
            USDC.safeTransfer(owner(), projectUSDC);
        }
        
        if (winnerURIM > 0) {
            URIM.safeTransfer(winner, winnerURIM);
            URIM.safeTransfer(owner(), projectURIM);
        }
        
        roundResults[currentRoundId] = RoundResult({
            winner: winner,
            totalPotUSDC: totalUSDC,
            totalPotURIM: totalURIM,
            winnerPayoutUSDC: winnerUSDC,
            winnerPayoutURIM: winnerURIM,
            timestamp: block.timestamp
        });
        
        emit WinnerSelected(currentRoundId, winner, winnerUSDC, winnerURIM);
        
        _startNewRound();
    }

    // ========== EMERGENCY FUNCTIONS ==========

    /**
     * @notice EMERGENCY: Manually pick winner if VRF fails
     * @dev Uses block hash for randomness - not as secure as VRF but works in emergency
     */
    function emergencySelectWinner() external onlyOwner {
        require(roundState == RoundState.DRAWING, "Not in drawing state");
        require(currentRoundPlayers.length > 0, "No players");
        
        // Use blockhash as randomness source (less secure but works)
        uint256 randomNumber = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            currentRoundPlayers.length
        )));
        
        _selectWinner(randomNumber);
        emit ManualWinnerSelected(currentRoundId, roundResults[currentRoundId].winner);
    }

    /**
     * @notice EMERGENCY: Withdraw all USDC
     */
    function emergencyWithdrawUSDC() external onlyOwner {
        uint256 balance = USDC.balanceOf(address(this));
        require(balance > 0, "No USDC");
        USDC.safeTransfer(owner(), balance);
        emit EmergencyWithdraw(address(USDC), balance);
    }

    /**
     * @notice EMERGENCY: Withdraw all URIM
     */
    function emergencyWithdrawURIM() external onlyOwner {
        uint256 balance = URIM.balanceOf(address(this));
        require(balance > 0, "No URIM");
        URIM.safeTransfer(owner(), balance);
        emit EmergencyWithdraw(address(URIM), balance);
    }

    /**
     * @notice EMERGENCY: Withdraw any ERC20 token
     */
    function emergencyWithdrawToken(address token) external onlyOwner {
        require(token != address(0), "Invalid token");
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "No tokens");
        IERC20(token).safeTransfer(owner(), balance);
        emit EmergencyWithdraw(token, balance);
    }

    /**
     * @notice EMERGENCY: Reset state if stuck in DRAWING
     */
    function emergencyResetState() external onlyOwner {
        roundState = RoundState.OPEN;
    }

    // ========== REGULAR FUNCTIONS ==========

    function _startNewRound() internal {
        currentRoundId++;
        currentRoundEndTime = block.timestamp + ROUND_DURATION;
        delete currentRoundPlayers;
        currentRoundTotalUSDC = 0;
        currentRoundTotalURIM = 0;
        roundState = RoundState.OPEN;
        
        emit RoundStarted(currentRoundId, currentRoundEndTime);
    }

    function getCurrentRoundInfo() external view returns (uint256 roundId, uint256 endTime, uint256 totalPlayers, uint256 totalUSDC, uint256 totalURIM, uint256 timeLeft, RoundState state) {
        uint256 remaining = block.timestamp >= currentRoundEndTime ? 0 : currentRoundEndTime - block.timestamp;
        return (currentRoundId, currentRoundEndTime, currentRoundPlayers.length, currentRoundTotalUSDC, currentRoundTotalURIM, remaining, roundState);
    }

    function getRoundResult(uint256 roundId) external view returns (RoundResult memory) {
        return roundResults[roundId];
    }

    function getCurrentPlayers() external view returns (address[] memory) {
        return currentRoundPlayers;
    }

    function getContractBalances() external view returns (uint256 usdcBalance, uint256 urimBalance) {
        return (USDC.balanceOf(address(this)), URIM.balanceOf(address(this)));
    }
}
