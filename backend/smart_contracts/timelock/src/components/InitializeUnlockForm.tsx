import { useWallet } from '@solana/wallet-adapter-react';
import { TOKEN_VESTING_PROGRAM_ID, NEPTUNE_MINT } from '../commands/const'
import {Connection, PublicKey, clusterApiUrl} from "@solana/web3.js";
import * as anchor from "@project-serum/anchor";
import { unlock } from '../commands/main'
import { signTransactionInstructions } from 'commands/utils';
import {Button} from "react-bootstrap";

const InitializeUnlockForm = (props:any) => {
  const walletContext: any = useWallet();
  const initializeUnlock = async (
  ) => {
    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
    const provider = new anchor.Provider(connection, walletContext, anchor.Provider.defaultOptions());
    const userAccount = provider.wallet.publicKey;
    const mintPk = NEPTUNE_MINT;

    const instruction = await unlock(
      connection, 
      TOKEN_VESTING_PROGRAM_ID,
      userAccount,
      mintPk,
    );

    const tx = await signTransactionInstructions(
      connection, 
      userAccount,
      instruction
    );

    console.log("transaction", tx)
  }
  return (
    <>
      <Button onClick={
          async () => {

              initializeUnlock(
              );

          }
      }>
          Click to unlock tokens!
      </Button>
    </>
  );
}

export default InitializeUnlockForm;
