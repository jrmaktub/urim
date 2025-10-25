# UrimMarket

# Sponzor implementations

## Pyth

We are using Pyth Oracle Price feeds on Base Sepolia to fetch USD/ETH prize with Hermes. Once that is done we are using the Pyth price to create Markets based on the current ETH/USD prize. After the user bets, we will resolve the market with the pyth.getPriceNoOlderThan() function to decide whether option A or B won the prediction. So basically we decide with Pyth how to resolve each market on Urim.

## Avail

In order to make URIM a cross-chain app, we have decided to use Avail widgets with RainbowKit integration to our React Vite app. After Nexus SDK initialization, we are fetching the unified balances automatically, which we present on the frontend. We also have a bridge function available with avail from Optimism Sepolia to Base Sepolia, since that is the main chain we are using right now. But we have also provided the users with a one click opportunity that if they do not have USDC on baseSepolia, they can bridge and execute the bets with one click. Making it user friendly to avoid swaps which takes longer time.

## Blockscout

We integrated Blockscout SDK to track the blockchain transactions we are doing in our Urim app. 

## Our Deployed contracts

PythUrimQuantumMarket: 0x7fE72eaa31a8c51B05FAc65A271Ad093C1b6032C
UrimQuantumMarket: 0xD81B1d003c1d30639F74a74109c189E6A4bD0726

