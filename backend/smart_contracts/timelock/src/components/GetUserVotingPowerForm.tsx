import {Button} from "react-bootstrap";
import {
  Connection, 
  PublicKey, 
  clusterApiUrl, 
} from "@solana/web3.js";
import {
  TOKEN_VESTING_PROGRAM_ID,
  NEPTUNE_MINT,
  SCHEDULE_SIZE
} from '../commands/const';
import {
  Numberu64,
  getAccountInfo,
  deriveAccountInfo,
  getScheduleAmount,
  getScheduleReleaseDate,
  signTransactionInstructions,
} from '../commands/utils'
import { useWallet } from '@solana/wallet-adapter-react';
import * as anchor from "@project-serum/anchor";
import { userOnChainVotingPower } from "commands/main";
import { Schedule } from '../commands/state';


const UserVotingPowerForm = (props: any) => {

  const walletContext: any = useWallet();

  const getUserVotingPower = async (
  ) => {
    console.log("getting on chain voting power for connected user!");

  //get nuts and bolts
  const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
  const provider = new anchor.Provider(connection, walletContext, anchor.Provider.defaultOptions());
  const userPk = provider.wallet.publicKey
  var userBuffer = userPk.toBuffer();
  const mintPk = NEPTUNE_MINT;

  //get the key of the vesting acount based on the user's public key and the program's public key. 
  const arr = await deriveAccountInfo(
    userBuffer,
    TOKEN_VESTING_PROGRAM_ID,
    mintPk
  );
  const vestingAccountKey = arr[0];
  const seed = arr[2];
  
  //get instructions
  const instruction = await userOnChainVotingPower(
    connection,
    userPk,
    vestingAccountKey,
    seed
  );

  console.log("instructions", instruction);

  //send transaction
  const tx = await signTransactionInstructions(
    connection,
    userPk,
    instruction,
  );

  console.log("check the program log of the solana explorer to see the on chain voting power");
  console.log(`Transaction for voting power test: ${tx}`);

}

  
  return (
    <>
      <Button onClick={
          async () => {

              getUserVotingPower(
              );

          }
      }>
          Click to return the user's on chain voting power!
      </Button>
    </>
  );
};

export default UserVotingPowerForm;