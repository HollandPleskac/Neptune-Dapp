# Dapp Structure:

Subdomains:

1) dapp.neptune.domain

	- dapp.neptune.domain/
		- this is the dashboard
	- dapp.neptune.domain/deposit/token_name
	- dapp.neptune.domain/borrow/token_name
	- dapp.neptune.domain/withdraw/token_name
	- dapp.neptune.domain/repay/token_name

	- dapp.neptune.domain/stake

	- dapp.neptune.domain/dao



2) docs.neptune.domain
	- docs.neptune.domain/
	- docs.neptune.domain/dapp


3) dao.neptune.domain
	- TBD whether we'll use this
	- Encapsulating all actual dapp user interactions within the dapp subdomain is probably ideal


4) api.neptune.domain

5) analytics.neptune.domain
	- analytics.neptune.domain/
	- analytics.neptune.domain/dapp
	- analytics.neptune.domain/dapp/lending
	- analytics.neptune.domain/dapp/stake
	- analytics.neptune.domain/dapp/portfolio
	- analytics.neptune.domain/dapp/dao
	- analytics.neptune.domain/dapp/dao/treasury


	- analytics.neptune.domain/(dashboards)


Repositories:

1) neptune_dapp

- This repo is for all the logic behind the dapp protocol itself, from our frontend components to our backend logic


	- frontend-ui will be where all frontend code lives
	- backenbd will contain all smart_contracts and other backend dependencies

2) neptune_dapp_sdk

- This repo is an SDK for our dapp, it should have startup code examples, and allow people to connect with the dapps smart contract logic with ease
	- Our focus should be on releasing an typescript SDK

3) neptune_docs

- This is a docs monorepo that should contain documentation for all Neptune products

	- The homepage should be located at:
		- docs.neptune.domain/
		- This should give a clear outline of the documentation for all Neptune features and products

---------TBA--------------


