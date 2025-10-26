// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/*
 URIM QUANTUM MARKET — FINAL INTEGRATED VERSION
 ------------------------------------------------------------
 ✅ Base Sepolia compatible
 ✅ Single deployment handles all markets
 ✅ Uses Chainlink Functions + OpenAI (via your Chainlink sub ID 503)
 ✅ Automatic outcome resolution with claim-based payouts

*/

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";
import {ConfirmedOwner} from "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";

contract UrimQuantumMarket is ReentrancyGuard, FunctionsClient, ConfirmedOwner {
    using SafeERC20 for IERC20;
    using FunctionsRequest for FunctionsRequest.Request;
    using FunctionsRequest for FunctionsRequest.Request;

    // ----------- STRUCTS -----------
    struct Market {
        string question;
        address creator;
        uint256 yesPool;
        uint256 noPool;
        bool resolved;
        bool outcome; // true = YES wins
        uint256 closeTime;
        mapping(address => uint256) yesBets;
        mapping(address => uint256) noBets;
    }

    // ----------- STORAGE -----------
    mapping(uint256 => Market) public markets;
    uint256 public marketCount;

    IERC20 public immutable collateral;   // e.g. USDC / PYUSD
    bytes32 public lastRequestId;
    string public sourceCode;             // Chainlink Functions JS code
    uint64 public constant SUBSCRIPTION_ID = 503; // your Chainlink sub ID
    uint32 public constant GAS_LIMIT = 300000;
    bytes32 public donId; // DON ID for Chainlink Functions

    // ----------- EVENTS -----------
    event MarketCreated(uint256 indexed id, string question, uint256 closeTime);
    event BetPlaced(uint256 indexed id, address indexed user, bool yes, uint256 amount);
    event MarketResolved(uint256 indexed id, bool outcome);
    event Claimed(uint256 indexed id, address indexed user, uint256 payout);
    event OracleRequestSent(bytes32 indexed requestId, uint256 indexed marketId);

    // ----------- CONSTRUCTOR -----------
    constructor(address _collateral, address _functionsRouter, bytes32 _donId)
        FunctionsClient(_functionsRouter)
        ConfirmedOwner(msg.sender)
    {
        collateral = IERC20(_collateral);
        donId = _donId;

        // Chainlink Functions source code (OpenAI integration)
        sourceCode = string(
            abi.encodePacked(
                "const question = args[0];",
                "const resp = await Functions.makeHttpRequest({",
                "  url: 'https://api.openai.com/v1/chat/completions',",
                "  method: 'POST',",
                "  headers: {",
                "    'Authorization': `Bearer ${secrets.openAiKey}`,",
                "    'Content-Type': 'application/json'",
                "  },",
                "  data: {",
                "    model: 'gpt-4o-mini',",
                "    messages: [",
                "      { role: 'system', content: \"Return only 'true' if the YES outcome is correct, otherwise return 'false'.\" },",
                "      { role: 'user', content: question }",
                "    ]",
                "  }",
                "});",
                "const reply = resp.data.choices[0].message.content.toLowerCase();",
                "const result = reply.includes('true') ? 'true' : 'false';",
                "return Functions.encodeString(result);"
            )
        );
    }

    // ----------- CORE LOGIC -----------

    function createMarket(string calldata question, uint256 duration)
        external
        returns (uint256 id)
    {
        id = marketCount++;
        Market storage m = markets[id];
        m.question = question;
        m.creator = msg.sender;
        m.closeTime = block.timestamp + duration;

        emit MarketCreated(id, question, m.closeTime);
    }

    function bet(uint256 id, bool yes, uint256 amount) external nonReentrant {
        Market storage m = markets[id];
        require(block.timestamp < m.closeTime, "Market closed");
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

    // ----------- ORACLE RESOLUTION -----------

    function resolveFromOracle(uint256 marketId) external onlyOwner {
        Market storage m = markets[marketId];
        require(!m.resolved, "Already resolved");
        require(block.timestamp >= m.closeTime, "Too early");

        string[] memory args = new string[](1);
        args[0] = m.question;

        bytes32 reqId = _sendRequest(
            sourceCode,
            SUBSCRIPTION_ID,
            GAS_LIMIT,
            args
        );
        lastRequestId = reqId;

        emit OracleRequestSent(reqId, marketId);
    }

    function _sendRequest(
        string memory src,
        uint64 subId,
        uint32 gasLimit,
        string[] memory args
    ) internal returns (bytes32 requestId) {
        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(src);
        if (args.length > 0) req.setArgs(args);
        requestId = _sendRequest(req.encodeCBOR(), subId, gasLimit, donId);
    }

    function fulfillRequest(bytes32 requestId, bytes memory response, bytes memory /* err */)
        internal
        override
    {
        bool outcome = keccak256(response) == keccak256(bytes("true"));
        for (uint256 i; i < marketCount; i++) {
            Market storage m = markets[i];
            if (!m.resolved && requestId == lastRequestId) {
                m.resolved = true;
                m.outcome = outcome;
                emit MarketResolved(i, outcome);
                break;
            }
        }
    }

    // ----------- CLAIMING -----------

    function claim(uint256 id) external nonReentrant {
        Market storage m = markets[id];
        require(m.resolved, "Not resolved yet");

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

    // ----------- VIEW HELPERS -----------

    function getMarket(uint256 id)
        external
        view
        returns (
            string memory question,
            address creator,
            uint256 yesPool,
            uint256 noPool,
            bool resolved,
            bool outcome,
            uint256 closeTime
        )
    {
        Market storage m = markets[id];
        return (m.question, m.creator, m.yesPool, m.noPool, m.resolved, m.outcome, m.closeTime);
    }
}
