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
        
        uint256 winnerIndex = randomWords[0] % currentRoundPlayers.length;
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
        
        roundResults[roundId] = RoundResult({
            winner: winner,
            totalPotUSDC: totalUSDC,
            totalPotURIM: totalURIM,
            winnerPayoutUSDC: winnerUSDC,
            winnerPayoutURIM: winnerURIM,
            timestamp: block.timestamp
        });
        
        emit WinnerSelected(roundId, winner, winnerUSDC, winnerURIM);
        
        _startNewRound();
    }

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
}
