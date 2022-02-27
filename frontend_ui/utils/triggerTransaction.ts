import {
  PublicKey,
  Connection,
  TransactionSignature,
  Transaction,
} from '@solana/web3.js';
import {
  SendTransactionOptions,
  WalletNotConnectedError,
} from '@solana/wallet-adapter-base';

import { SolendAction } from '../libs/neptune_dapp_sdk/src/classes/action';

// const useTriggerTransaction = ({
//   inputValue,
//   publicKey,
//   connection,
//   sendTransaction,
// }: Props) => {
//   // const { publicKey, sendTransaction } = useWallet();
//   // const { connection } = useConnection();

export const triggerTransaction = async ({
  inputValue,
  publicKey,
  connection,
  sendTransaction,
}: Props) => {
  if (!publicKey) throw new WalletNotConnectedError();
  try {
    const depositAction = await SolendAction.buildDepositTxns(
      connection,
      inputValue, //note, amount is in lamports for transactions in SOL
      'SOL',
      publicKey,
      'devnet',
    );
    const sig = await depositAction.sendTransactions(sendTransaction);
    // const signature = await sendTransaction(depositAction, connection);
    await connection.confirmTransaction(sig, 'processed');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Transaction error', err);
  }
};

//   triggerTransaction();
// };

type Props = {
  inputValue: string;
  publicKey: PublicKey;
  connection: Connection;
  sendTransaction: (
    txn: Transaction,
    connection: Connection,
    options?: SendTransactionOptions,
  ) => Promise<TransactionSignature>;
};
