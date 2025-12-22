import {
  createWalletClient,
  createPublicClient,
  http,
  formatEther,
  type WalletClient,
  type PublicClient,
  type Hash,
  type TransactionReceipt,
  type Chain,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import type { WalletServerConfig, TransactionParams } from './types.js';
import { ANVIL_ACCOUNTS } from './types.js';

/**
 * Wallet wrapper using Viem for Ethereum operations
 */
export class Wallet {
  private walletClient: WalletClient;
  private publicClient: PublicClient;
  private account: ReturnType<typeof privateKeyToAccount>;
  private chain: Chain;
  private rpcUrl: string;
  private currentAccountIndex: number;

  constructor(config: WalletServerConfig) {
    this.account = privateKeyToAccount(config.privateKey);
    this.rpcUrl = config.anvilRpcUrl;
    this.currentAccountIndex = config.accountIndex;

    // Create a custom chain definition for Anvil
    this.chain = {
      ...foundry,
      id: config.chainId,
    };

    this.walletClient = createWalletClient({
      account: this.account,
      chain: this.chain,
      transport: http(config.anvilRpcUrl),
    });

    this.publicClient = createPublicClient({
      chain: this.chain,
      transport: http(config.anvilRpcUrl),
    });
  }

  /**
   * Switch to a different Anvil account by index (0-9)
   */
  switchAccount(accountIndex: number): void {
    if (accountIndex < 0 || accountIndex > 9) {
      throw new Error(`Account index must be between 0 and 9, got ${accountIndex}`);
    }

    const newAccount = ANVIL_ACCOUNTS[accountIndex];
    this.account = privateKeyToAccount(newAccount.privateKey);
    this.currentAccountIndex = accountIndex;

    // Recreate wallet client with new account
    this.walletClient = createWalletClient({
      account: this.account,
      chain: this.chain,
      transport: http(this.rpcUrl),
    });
  }

  /**
   * Switch to a custom private key
   */
  switchToPrivateKey(privateKey: `0x${string}`): void {
    this.account = privateKeyToAccount(privateKey);
    this.currentAccountIndex = -1; // Custom key, not an Anvil index

    // Recreate wallet client with new account
    this.walletClient = createWalletClient({
      account: this.account,
      chain: this.chain,
      transport: http(this.rpcUrl),
    });
  }

  /**
   * Get the current account index (-1 if using custom private key)
   */
  getAccountIndex(): number {
    return this.currentAccountIndex;
  }

  /**
   * List all available Anvil accounts
   */
  static listAnvilAccounts(): Array<{ index: number; address: string }> {
    return ANVIL_ACCOUNTS.map((acc, index) => ({
      index,
      address: acc.address,
    }));
  }

  /**
   * Get the wallet's address
   */
  getAddress(): `0x${string}` {
    return this.account.address;
  }

  /**
   * Get the chain ID
   */
  getChainId(): number {
    return this.chain.id;
  }

  /**
   * Set the chain ID used for signing transactions
   * This recreates the wallet client and public client with the new chain
   */
  setChainId(chainId: number): void {
    if (!Number.isInteger(chainId) || chainId <= 0) {
      throw new Error('Chain ID must be a positive integer');
    }

    // Update the chain definition
    this.chain = {
      ...foundry,
      id: chainId,
    };

    // Recreate clients with new chain
    this.walletClient = createWalletClient({
      account: this.account,
      chain: this.chain,
      transport: http(this.rpcUrl),
    });

    this.publicClient = createPublicClient({
      chain: this.chain,
      transport: http(this.rpcUrl),
    });
  }

  /**
   * Get ETH balance of an address (defaults to wallet address)
   */
  async getBalance(address?: `0x${string}`): Promise<string> {
    const targetAddress = address ?? this.account.address;
    const balance = await this.publicClient.getBalance({ address: targetAddress });
    return formatEther(balance);
  }

  /**
   * Send a transaction
   */
  async sendTransaction(params: TransactionParams): Promise<Hash> {
    // Build base transaction parameters
    const txParams: Parameters<typeof this.walletClient.sendTransaction>[0] = {
      account: this.account,
      to: params.to,
      value: params.value ? BigInt(params.value) : undefined,
      data: params.data,
      gas: params.gas ? BigInt(params.gas) : undefined,
      nonce: params.nonce ? parseInt(params.nonce, 16) : undefined,
      chain: this.chain,
    };

    // Handle gas pricing - either legacy (gasPrice) or EIP-1559 (maxFeePerGas + maxPriorityFeePerGas)
    // Don't mix both - EIP-1559 takes precedence if provided
    if (params.maxFeePerGas || params.maxPriorityFeePerGas) {
      // EIP-1559 transaction
      Object.assign(txParams, {
        maxFeePerGas: params.maxFeePerGas ? BigInt(params.maxFeePerGas) : undefined,
        maxPriorityFeePerGas: params.maxPriorityFeePerGas ? BigInt(params.maxPriorityFeePerGas) : undefined,
      });
    } else if (params.gasPrice) {
      // Legacy transaction
      Object.assign(txParams, {
        gasPrice: BigInt(params.gasPrice),
      });
    }

    const hash = await this.walletClient.sendTransaction(txParams);
    return hash;
  }

  /**
   * Sign a message (personal_sign)
   */
  async signMessage(message: string): Promise<`0x${string}`> {
    const signature = await this.walletClient.signMessage({
      account: this.account,
      message,
    });
    return signature;
  }

  /**
   * Sign typed data (eth_signTypedData_v4)
   */
  async signTypedData(typedData: {
    domain: Record<string, unknown>;
    types: Record<string, unknown>;
    primaryType: string;
    message: Record<string, unknown>;
  }): Promise<`0x${string}`> {
    const signature = await this.walletClient.signTypedData({
      account: this.account,
      domain: typedData.domain as Parameters<typeof this.walletClient.signTypedData>[0]['domain'],
      types: typedData.types as Parameters<typeof this.walletClient.signTypedData>[0]['types'],
      primaryType: typedData.primaryType,
      message: typedData.message,
    });
    return signature;
  }

  /**
   * Get transaction receipt
   */
  async getTransactionReceipt(hash: Hash): Promise<TransactionReceipt | null> {
    try {
      const receipt = await this.publicClient.getTransactionReceipt({ hash });
      return receipt;
    } catch {
      return null;
    }
  }

  /**
   * Wait for transaction to be mined
   */
  async waitForTransaction(hash: Hash): Promise<TransactionReceipt> {
    return await this.publicClient.waitForTransactionReceipt({ hash });
  }

  /**
   * Get current block number
   */
  async getBlockNumber(): Promise<bigint> {
    return await this.publicClient.getBlockNumber();
  }

  /**
   * Get current gas price
   */
  async getGasPrice(): Promise<bigint> {
    return await this.publicClient.getGasPrice();
  }

  /**
   * Estimate gas for a transaction
   */
  async estimateGas(params: TransactionParams): Promise<bigint> {
    return await this.publicClient.estimateGas({
      account: this.account,
      to: params.to,
      value: params.value ? BigInt(params.value) : undefined,
      data: params.data,
    });
  }

  /**
   * Get transaction count (nonce) for an address
   */
  async getTransactionCount(address?: `0x${string}`): Promise<number> {
    const targetAddress = address ?? this.account.address;
    return await this.publicClient.getTransactionCount({ address: targetAddress });
  }
}
