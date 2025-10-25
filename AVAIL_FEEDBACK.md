# Avail Feedback 

## Vite Template not working with the updated packages.

- After the Nexus Initialization, The Send function is not functional at all, it is not possible to send transactions with it.  ( Picture attached in the AVAIL_FEEDBACK_PICTURES folder)


## Bridge and BridgeAndExecute widgets

- Both the Bridge and BridgeAndExecute buttons have the issue that sometimtes you need to click on them multiple times in order to start the transactions. During this, when I was trying to test things to send USDC token from OP Sepolia to Base Sepolia, 2-3 times I have to click the Bridge button in order to start the execution and it also switches the chain back automatically to the destination chain which is a bit annoying. Tried a workaround it, did not really found one. The executions comes to an end and will be confirmed, but its experience can be made much smoother in my opinion.

## Package version issues

I have been informed that I should use the following packages:

    "@avail-project/nexus-core": "^0.0.2",
    "@avail-project/nexus-widgets": "^0.0.6",

    Unfortunately these packages are not working well currently because after the update, neither the Bridge and BridgeAndExecute widges stopped working, they have both given the RPC related error, which I was unable to resolve. 

All in All the documentation were okay, it was a bit hard for me to find the rainbowKitIntegration github repo, but after I have found I was successfully able to pull together my Rainbowkit. 