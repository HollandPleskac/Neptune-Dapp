# Timelocked Staking Application With Voting Power

THIS BRANCH HAS CODE FOR STORING POINT OBJECTS AS A SERIALIZED BYTE ARRAY, WHICH IS MORE COMPUTATIONALLY EFFICIENT THAN USING A BTREEMAP OBJECT.

This repo builds a frontend to [Bonfida's token vesting program](https://github.com/Bonfida/token-vesting) using the nextjs scaffold [provided by thuglabs](https://github.com/thuglabs/create-dapp-solana-nextjs). It allows a user to lock a set amount of tokens from a given mint account for a set amount of time. Once the specified time has past, the same user will be able to claim the tokens again.

Additionally, this program includes a system for governance voting power based on the tokens a user has staked. The implementation of this voting power system borrows heavily from Curve Finance's veCRV system. The docs describing their system are [here](https://curve.readthedocs.io/dao-vecrv.html#curve-dao-vote-escrowed-crv) and the smart contract implementing their system is [here](https://etherscan.io/address/0x5f3b5dfeb7b28cdbd7faba78963ee202a494e2a2#code)

The program is deployed to Solana devnet. Its current program ID is `5SNyjY9h9RkCS2Kv1GeQKWjEnWnZns1e7DaZKdnjAreC`. This program ID is hard coded for the app to use in `src/commands/const`.

## Voting Power Information
We implement Curve's voting power mechanism on Solana. This strategy relies on syncing the entire protocol to a calendar. We've chosen to represent one entry in the calendar as one week in normal time. In terms of our calendar, this unit of time is called an `epoch`.

There are 26 `epochs` in one `era`. This evens out to about 6 months per `era`. The first `era` of our protocol begins at the `ZERO_EPOCH_TS` of `1641427200`: this is the unix timestampf or 1/6/22 0000 GMT. 

Each `era` has three kinds of `window` accounts associated with it:
* a `pointer` account. This is a static PDA that stores the `era`'s `calendar` and `dslope` accounts
* a `calendar` account. This is a dynamic PDA that stores `point` objects. One `point` object represents one `epoch` in our protocol's calendar. These `point` objects hold information that can be easily used to derive the voing power of the entire protocol and are defined in `state.rs`. Anytime a user interacts with the staking program, the `calendar` account for the current `era` is updated
* a `dslope` account. This stores changes that should ocurr in the `calendar` account at some point in the future when a user's tokens are available to claim.

Whenever a user interacts with a staking position, there are two things that happen
1. the protocol checks to see if new `window` accounts are needed for the timeframes a user is interacting with in their staking position. The program checks both the current timeframe, and the future timeframe when tokens are unlocked.
2. the protocol updates the protocol's voting power. For instance, if no one has interacted with the staking protocol for three weeks, than the last filed `point` object will be three weeks in the past: we will need to update the protocol to the current `epoch` before we can file the changes caused by the user interacting with the protocol.
3. the user's changes are filed to the up to date protocol, and to the user specific data account that tracks their staking position.

Solana's characteristics put two significant constraints on our design. 
*In order to stay under the Solana compute limit, we only allow our protocol to file up to one `era`'s worth of data in a single transaction.  
* in order to keep our PDAs below the 10kb size limit, we only represent 26 `epoch`s worth of data in one set of accounts

These constraints make updating the protocol voting power the most complex part of our program, as it means there are a minimum of 2 sets of `window` accounts involved, for a grand total of 6 accounts to manage. These two sets are the window start accounts and window end accounts. We need to rely in this structure in case the current `epoch` is in a different `era` than the last filed `epoch`. In that case, the `window` accounts for the previous `era` represent the window start, and the `window` accounts for the current `era` represent the window end: we need to fill the window start `calendar` account, then begin recording data in the window end `calendar` account.

In these diagrams, `+` is the last filed `epoch` and `\` is the current `epoch`.

                                          time to update
                                   |--------------------------|
                    |--------------+-----------|   |----------\---------------|
                            window start                   window end

By contrast, if the current `epoch` lives in the same `era` as the last filed `epoch`, then we have significantly less data to update, and we don't need to touch the window end accounts.

                                time to update
                                   |----|
                    |--------------+----\------|   |--------------------------|
                            window start                   window end

## Frontend Use Instructions

Start the app by running `yarn dev` in `src`. Once the app starts, you can connect your Phantom wallet and will be greeted with two sliders and a text box. The large slider allows you to choose how long you lock your tokens for, anywhere from 0 to 4 years. The small slider allows you to manually type in as small a lockup period as you want, which is helpful for testing. The smallest increment available is 0.0001 years, which is about 1.5 hours

The text box allows you to specify the amount of tokens you're locking. We're assuming that the mint of the tokens locked will be our Neptune tokens. For reference, I've created a 'Neptune' mint on devnet: `3SRBwtc6r84HPLBqMNQCLNFFuGCwMc7Aof7Ngiqg9JsX`. This mint is hard coded for the app to use in `src/commands/const`.

Once you specify the required information, click the `lock tokens` button to lock tokens. The first time you lock tokens, three accounts will be created: a vesting account, a vesting token account and a data account. 

• The vesting account is a PDA owned by the vesting program. Its data field is populated by a `VestingScheduleHeader` struct that is defined in in `programs/src/state.rs`. its public key is derived from the public key of the wallet connected to the application. This means we can easily re-derive it, so there's no need for us to keep track of which vesting account belongs to which wallet. 

• The vesting token account is an spl token account to hold the Neptune tokens the user has locked.

• The data account is a PDA owned by the vesting program. Its public key is stored in the `VestingScheduleHeader` of the vesting account. It stores data on when a user is able to claim their locked tokens in the form of a `VestingSchedule` data structure that's defined in `programs/src/state.rs`. 

Each `VestingSchedule` represents one instance of a user locking tokens into our protocol. It has two parts

• amount - the amount of tokens to lock

• release_time - the time these tokens are claimable. On the blockchain, this comes in the form of seconds since the unix zero time. 

Every subsequent time a wallet locks tokens, the following process ocurrs.
1. a new data account is created.
2. we obtain the old `VestingSchedule`s from the old data account we find in the `VestingScheduleHeader` of the vesting account.
3. we save the old `VestingSchedule`s and the new `VestingSchedule` from the latest token lock into the new data account.
4. We replace the old data account in the vesting account's `VestingScheduleHeader` with the new data account.
5. We close the old data account by zeroing its lamports and transferring them back to the user's wallet. 

The new data account is a PDA with a public key derived from the old data account's public key. We handle subsequent token locking in this way because solana accounts cannot increase their size once they're created. In order to keep a user's vesting account consistent, we store the inconsistent data in the separate data account. This allows a user to lock tokens whenever they want while nullifying the need for us to track which vesting account belongs to which user. We can simply derive their vesting account from their prublic key, and look to the current data account stored in the `VestingScheduleHeader` to see when tokens should be released.

There is also a `display info!` button in the app. This button will query the blockchain to find the vesting account and data account associated with the connected wallet. It will print information about the data account's `VestingSchedule`s to the developer console, such as how many tokens can be claimed, when the user can claim them and the user's current voting power. This is very helpful for testing.

You can use the `unlock tokens` button to send tokens from the vesting token account to your own personal token account once we've passed the timestamp stored in a `VestingSchedule` in the data account.

Finally, you can use the `test on chain voting power` button to test the on chain function that calculates a user's current voting power. There is also a `getVotingPower` function in `commands/utils` that calculates the voting power on the client side. The `test on chain voting power` button will create a transaction that passes the client side voting power to the blockchain and re-calculates the voting power value using data on chain. The voting power program logs the client voting power and the on chain voting power to the program log of the transaction: you can get the transaction hash from the dev console, and check Solana explorer for the program log. I figured this was best because Solana programs can't pass any values back to the client.

Here is the formula for calculating one schedule object's voting power. Note that this strategy is taken from Curve Finance's method for calculating voting power according to the balanceOf method in [their voting escrow smart contract.](https://etherscan.io/address/0x5f3b5dfeb7b28cdbd7faba78963ee202a494e2a2#code).

(tokens in schedule / max time to lock in seconds) * time left until unlock in seconds

We calculate this voting power value for each schedule object that
1. has a non zero token balance
2. AND has not passed its release time.

Then we take the average of the voting power values we've calculated to obtain the user's total voting power. using this strategy, users will obtain more voting power for voting more tokens for a longer period of time. 

## Testing instructions

# TODO:
Before creating a new data account, check to see if there are any schedules with no tokens for release in the data account. This happens when a user claims tokens. If that's the case, erase those schedules from the data account when unlocking tokens so the user doesn't carry around that empty data.
