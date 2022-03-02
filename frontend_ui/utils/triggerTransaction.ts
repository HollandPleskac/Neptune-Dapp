// import {
//   PublicKey,
//   Connection,
//   TransactionSignature,
//   Transaction,
// } from '@solana/web3.js';
// import { SendTransactionOptions } from '@solana/wallet-adapter-base';

// import { SolendAction } from '../libs/neptune_dapp_sdk/src/classes/action';

export const triggerTransaction = async ({
  // inputValue,
  // publicKey,
  // connection,
  // sendTransaction,
}: Props) => {
  // if (!publicKey) {
  //   return;
  // }
  try {
    // const depositAction = await SolendAction.buildDepositTxns(
    //   connection,
    //   inputValue, //note, amount is in lamports for transactions in SOL
    //   'SOL',
    //   publicKey,
    //   'devnet',
    // );
    // const sig = await depositAction.sendTransactions(sendTransaction);
    // await connection.confirmTransaction(sig, 'processed');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Transaction error', err);
  }
};

type Props = {
  // inputValue: string;
  // publicKey: PublicKey | null;
  // connection: Connection;
  // sendTransaction: (
  //   txn: Transaction,
  //   connection: Connection,
  //   options?: SendTransactionOptions,
  // ) => Promise<TransactionSignature>;
};
