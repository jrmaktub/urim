import { useState, useEffect } from 'react';
import { BrowserProvider, formatEther } from 'ethers';

const SEPOLIA_CHAIN_ID = '0xaa36a7'; // 11155111 in decimal
const SEPOLIA_RPC = 'https://eth-sepolia.g.alchemy.com/v2/27SvVEbGAVC2VSJ8rPss0';

export const useSepoliaWallet = () => {
  const [address, setAddress] = useState<string>("");
  const [balance, setBalance] = useState<string>("0");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);

  const checkConnection = async () => {
    if (typeof window.ethereum === 'undefined') return;

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
    if (typeof window.ethereum === 'undefined') return;

    try {
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      setIsCorrectNetwork(chainId.toLowerCase() === SEPOLIA_CHAIN_ID.toLowerCase());
    } catch (error) {
      console.error('Error checking network:', error);
    }
  };

  const getBalance = async (addr: string) => {
    if (typeof window.ethereum === 'undefined') return;

    try {
      const provider = new BrowserProvider(window.ethereum);
      const balanceWei = await provider.getBalance(addr);
      const balanceEth = formatEther(balanceWei);
      setBalance(parseFloat(balanceEth).toFixed(4));
    } catch (error) {
      console.error('Error getting balance:', error);
    }
  };

  const connect = async () => {
    if (typeof window.ethereum === 'undefined') {
      alert('Please install MetaMask to use this feature');
      return;
    }

    setIsConnecting(true);
    try {
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      setAddress(accounts[0]);
      await checkNetwork();
      await getBalance(accounts[0]);
    } catch (error) {
      console.error('Error connecting wallet:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    setAddress("");
    setBalance("0");
    setIsCorrectNetwork(false);
  };

  const switchToSepolia = async () => {
    if (typeof window.ethereum === 'undefined') return;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: SEPOLIA_CHAIN_ID }],
      });
    } catch (error: any) {
      // If the chain hasn't been added to MetaMask
      if (error.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: SEPOLIA_CHAIN_ID,
              chainName: 'Ethereum Sepolia',
              nativeCurrency: {
                name: 'ETH',
                symbol: 'ETH',
                decimals: 18
              },
              rpcUrls: [SEPOLIA_RPC],
              blockExplorerUrls: ['https://sepolia.etherscan.io/']
            }]
          });
        } catch (addError) {
          console.error('Error adding Sepolia network:', addError);
        }
      } else {
        console.error('Error switching to Sepolia:', error);
      }
    }
  };

  useEffect(() => {
    checkConnection();

    if (typeof window.ethereum !== 'undefined') {
      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length > 0) {
          setAddress(accounts[0]);
          getBalance(accounts[0]);
        } else {
          setAddress("");
          setBalance("0");
        }
      });

      window.ethereum.on('chainChanged', () => {
        checkNetwork();
        if (address) {
          getBalance(address);
        }
      });
    }

    return () => {
      if (typeof window.ethereum !== 'undefined') {
        window.ethereum.removeAllListeners('accountsChanged');
        window.ethereum.removeAllListeners('chainChanged');
      }
    };
  }, [address]);

  return {
    address,
    balance,
    isConnecting,
    isCorrectNetwork,
    connect,
    disconnect,
    switchToSepolia
  };
};

declare global {
  interface Window {
    ethereum?: any;
  }
}
