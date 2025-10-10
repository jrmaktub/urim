import { useState, useEffect } from 'react';

const ETHEREUM_SEPOLIA_CHAIN_ID = '0xaa36a7'; // Ethereum Sepolia testnet

export const useWallet = () => {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string>('0');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(true);

  useEffect(() => {
    checkConnection();
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, []);

  const checkConnection = async () => {
    if (!window.ethereum) return;

    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts.length > 0) {
        setAddress(accounts[0]);
        await checkNetwork();
        await getBalance(accounts[0]);
      }
    } catch (error) {
      console.error('Error checking connection:', error);
    }
  };

  const checkNetwork = async () => {
    if (!window.ethereum) return;

    try {
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      setIsCorrectNetwork(chainId.toLowerCase() === ETHEREUM_SEPOLIA_CHAIN_ID.toLowerCase());
    } catch (error) {
      console.error('Error checking network:', error);
    }
  };

  const handleAccountsChanged = (accounts: string[]) => {
    if (accounts.length === 0) {
      setAddress(null);
      setBalance('0');
    } else {
      setAddress(accounts[0]);
      getBalance(accounts[0]);
    }
  };

  const handleChainChanged = () => {
    window.location.reload();
  };

  const getBalance = async (addr: string) => {
    if (!window.ethereum) return;

    try {
      const bal = await window.ethereum.request({
        method: 'eth_getBalance',
        params: [addr, 'latest'],
      });
      const ethBalance = parseInt(bal, 16) / 1e18;
      setBalance(ethBalance.toFixed(4));
    } catch (error) {
      console.error('Error getting balance:', error);
    }
  };

  const connect = async () => {
    if (!window.ethereum) {
      alert('Please install MetaMask to use this feature');
      return;
    }

    setIsConnecting(true);
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      setAddress(accounts[0]);
      await checkNetwork();
      await getBalance(accounts[0]);
    } catch (error) {
      console.error('Error connecting wallet:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const switchToEthereumSepolia = async () => {
    if (!window.ethereum) return;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: ETHEREUM_SEPOLIA_CHAIN_ID }],
      });
    } catch (error: any) {
      if (error.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: ETHEREUM_SEPOLIA_CHAIN_ID,
                chainName: 'Ethereum Sepolia Testnet',
                nativeCurrency: {
                  name: 'Ethereum',
                  symbol: 'ETH',
                  decimals: 18,
                },
                rpcUrls: ['https://eth-sepolia.g.alchemy.com/v2/27SvVEbGAVC2VSJ8rPss0zVQWGzPA0wt'],
                blockExplorerUrls: ['https://sepolia.etherscan.io'],
              },
            ],
          });
        } catch (addError) {
          console.error('Error adding network:', addError);
        }
      }
    }
  };

  return {
    address,
    balance,
    isConnecting,
    isCorrectNetwork,
    connect,
    switchToEthereumSepolia,
  };
};

declare global {
  interface Window {
    ethereum?: any;
  }
}
