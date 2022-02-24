# Timelocked Staking Application With Voting Power

THIS BRANCH HAS CODE FOR STORING POINT OBJECTS AS A SERIALIZED BYTE ARRAY, WHICH IS MORE COMPUTATIONALLY EFFICIENT THAN USING A BTREEMAP OBJECT.

This repo builds a frontend to [Bonfida's token vesting program](https://github.com/Bonfida/token-vesting) using the nextjs scaffold [provided by thuglabs](https://github.com/thuglabs/create-dapp-solana-nextjs). It allows a user to lock a set amount of tokens from a given mint account for a set amount of time. Once the specified time has past, the same user will be able to claim the tokens again.

Additionally, this program includes a system for governance voting power based on the tokens a user has staked. The implementation of this voting power system borrows heavily from Curve Finance's veCRV system. The docs describing their system are [here](https://curve.readthedocs.io/dao-vecrv.html#curve-dao-vote-escrowed-crv) and the smart contract implementing their system is [here](https://etherscan.io/address/0x5f3b5dfeb7b28cdbd7faba78963ee202a494e2a2#code)

Our program is deployed to Solana devnet. Its current program ID is `5SNyjY9h9RkCS2Kv1GeQKWjEnWnZns1e7DaZKdnjAreC`. This program ID is hard coded for the app to use in `src/commands/const`.

## Voting Power Information
We implement Curve's voting power mechanism on Solana. This strategy relies on syncing the entire protocol to a calendar. We've chosen to represent one entry in the calendar as one week in normal time. In terms of our calendar, this unit of time is called an `epoch`.

There are 26 `epochs` in one `era`. This evens out to about 6 months per `era`. The first `era` of our protocol begins at the `ZERO_EPOCH_TS` of `1641427200`: this is the unix timestamp for 1/6/22 0000 GMT. 

Each `era` has three kinds of `window` accounts associated with it:
* a `pointer` account. This is a static PDA derived from the `era`'s first unix timestamp. It stores the `era`'s `calendar` and `dslope` accounts
* a `calendar` account. This is a dynamic PDA that stores `point` objects. One `point` object represents one `epoch` in our protocol's calendar. These `point` objects hold information that can be easily used to derive the voting power of the entire protocol, and are defined in `state.rs`. See below for details on how `point` objects track this information. Anytime a user interacts with the staking program, the `calendar` account for the current `era` is updated
* a `dslope` account. This stores changes that should ocurr in the `calendar` account at some point in the future when a user's tokens are available to claim.

Whenever a user interacts with a staking position, there are three things that happen
1. the protocol checks to see if new `window` accounts are needed for the timeframes a user is interacting with in their staking position. The program checks both the current timeframe, and the future timeframe when tokens are unlocked. If needed, the program creates these `window` accounts. 
2. the protocol updates the protocol's voting power. For instance, if no one has interacted with the staking protocol for three weeks, than the last filed `point` object will be three weeks in the past: we will need to update the protocol to the current `epoch`'s `point` before we can file the changes caused by the user interacting with a staking position.
3. the user's changes are filed to the up to date protocol, and to the user specific data account that tracks their staking position.

Solana's characteristics put two significant constraints on our design. 
* In order to stay under the Solana compute limit, we only allow our protocol to file up to one `era`'s worth of `calendar` data in a single transaction.  
* in order to keep our PDAs below the 10kb size limit, we only represent 26 `epoch`s worth of data in one set of accounts rather than use longer timeframes. 

These constraints make updating the protocol voting power the most complex part of our program; it means there are 2 sets of `window` accounts involved, for a grand total of 6 accounts to manage. These two sets are the window start accounts and window end accounts. We need to rely in this structure in case the current `epoch` is in a different `era` than the last filed `epoch`. In that case, the `window` accounts for the previous `era` represent the window start, and the `window` accounts for the current `era` represent the window end: we need to fill the window start's `calendar` account with data, then begin recording data in the window end `calendar` account.

In these diagrams, `-` represents one `epoch`. `+` is the last filed `epoch` and `\` is the current `epoch`.

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

This repo also features a rudimentary front end to interact with the staking program. Start the app by running `yarn dev` in `src`. Once the app starts, you can connect your Phantom wallet and will be greeted with two sliders and a text box. The large slider allows you to choose how long you lock your tokens for, anywhere from 0 to 4 years. The small slider allows you to manually type in as small a lockup period as you want, which is helpful for testing. The smallest increment available is 0.0001 years, which is about 1.5 hours

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

You can use the `Use this button to test the on chain function to calculate user voting power` button to test the on chain function that calculates a user's current voting power. There is also a `getUserVotingPower` function in `commands/utils` that calculates the voting power on the client side. The `test on chain voting power` button will create a transaction that passes the client side voting power to the blockchain and re-calculates the voting power value using data on chain. The voting power program logs the client voting power and the on chain voting power to the program log of the transaction: you can get the transaction hash from the dev console, and check Solana explorer for the program log. I figured this was best because Solana programs can't pass any values back to the client.

Here is the formula for calculating one schedule object's voting power. Note that this strategy is taken from Curve Finance's method for calculating voting power according to the balanceOf method in [their voting escrow smart contract.](https://etherscan.io/address/0x5f3b5dfeb7b28cdbd7faba78963ee202a494e2a2#code).

`slope = tokens_locked / MAX_LOCK_TIME_IN_SECONDS`

`bias = slope * (token_release_ts - staking_position_creation_ts) `

`voting_power = bias - (slope * (current_epoch_ts - staking_position_creation_ts))`

We calculate a user's total voting power by summing the voting power for each schedule object. Using this strategy, users will obtain more voting power for voting more tokens for a longer period of time. 

Finally, you can also use the `Use this button to test the on chain function to calculate protocol voting power. ` to test the protocol's voting power. This button issues an instruction to the program to make sure the protocol's `calendar` has been fully updated to the current `epoch`. This is critical for returning an accurate voting power.

Once we confirm the protocol has been updated, we use `calculateProtocolVotingPower` in `commands/utils` to calculate the protocol voting power. Rather than use schedule objects, we use `point` objects for this calculation. Since `point` objects store the `slope` and `bias` directly, this calculation is much simpler. Given the last filed point, 

`voting_power = point_bias - (point_slope * (current_epoch_ts - last_filed_point_ts))`

Since `current_epoch_ts` will equal `last_filed_point_ts` since we're sure the protocol has been updated, the equation simplifies to 

`voting_power` = `point_bias`

having the infrastructure for the equation in `calculateProtocolVotingPower` is helpful for if we ever want to calculate the protocol's voting power at some point in the past. 

## Testing instructions
Here are some misc notes on using the frontend to manually test voting power features

[This website](https://unixtime.org/) is very helpful for finding the unix timestamp in seconds for a given date. 

Outside of basic lock / unlock mechanics, there are a few time based things that need to be tested here.

	1. First, that the protocol voting power decreases as expected with each period
	2. second, that the protocol voting power fills in across multiple windows as expected.
	3. third, that we can fill in up to the max number of epochs without causing any problems. 

Here is the testing process for the first scenario
○ test behavior on smaller timescales fairly easily by modifying the seconds in an epoch via the SECONDS_IN_EPOCH constant in processor.rs and the SECONDS_IN_EPOCH constant in const.ts on the sdk side.
	§ A good number is five minutes to an epoch (300 sec). That means locking tokens for at least 0.00000951 years to lock to the next epoch.
	§ 0.000015 years to unlock in epoch +1
	§ 0.000021 years to unlock in epoch +2
	§ 0.000030 years to inlock in epoch +3
	§ 0.00004 years to unlock in epoch +4
○ Test goes like this
	§ set the seconds in epoch to 300.
	§ set the ZERO_EPOCH_TS constant to a recent unix timestamp (its super helpful if this is a time with minutes that's divisible by 5: makes scheduling tests much easier).
	§ lock up the same amount of tokens from three wallets such that the tokens unlock in different timeframes. So one wallet locks tokens until the next epoch, one locks tokens until the epoch after next, one locks tokens until the epoch AFTER that, etc.
	§ after each epoch has passed, check the protocol voting power. it will send a transaction to the blockchain to update the protocol stats, then log the voting power to the console. 


Here is the testing process for the second scenario: making sure the protocol voting power fills in multiple windows like we want it to.
○ we'll need to set the seconds in epoch to something very small, but still large enough to make a transaction go through. Maybe 20 seconds is the smallest we could go.
○ create a lock position at an epoch in the window start.
○ wait until the current epoch is in the window end. 
○ while in the window end, attempt to create another lock position. The position should create successfully, and protocol voting power should be accurate. 
○ Here's the testing plan
	§ set the zero epoch for the top of a known minute. epochs are 20 seconds long. an era is a 8 and 2/3rds minutes. 
	§ open up some lock positions. One that ends within the window start, and one that ends after. This is to test that the voting power decreases as needed.
	§ So if 0.00000951 years is 300 seconds, that means that 20 seconds is 0.00000063 years. 
		○ epoch + 1 is 0.0000007 years
		○ epoch + 13 is 0.0000083 years
		○ epoch + 30 is 0.0000189 years 
	§ based on the zero epoch, take note of the times that are 13 epochs past zero and 30 epochs past zero
	§ So create two time locked positions at zero time. Have one unlock 13 epochs in the future and another unlock at 30 epochs in the future. Then stop
	§ test that vp decreases appropriately when we pass the 13 epoch mark 
	§ Also test once we pass the 26 epoch mark. That means that we're filling in the window start AND the window end
	§ finally, test vp when we pass the 30 epoch mark. We should fill in 26 epochs worth of data without exceeding the solana compute limit.
	§ user and protocol voting power should stay in lockstep throughout the tests though, even when multiple positions are opened. 

# TODO:
Before creating a new data account, check to see if there are any schedules with no tokens for release in the data account. This happens when a user claims tokens. If that's the case, erase those schedules from the data account when unlocking tokens so the user doesn't carry around that empty data.

Make it so that users can edit existing staking positions, such as increasing the time tokens are locked for, or allocating more tokens to an exisiting position

Cap the number of staking positions a user can have. 
