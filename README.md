# js-starter-kit

Welcome to js-starter-kit!

This is a minimal client side wallet which allows you to make interactions with the OmiseGO network from a browser.

Before you get started, make sure you have a local instance of `elixir-omg` running or have access to an already deployed network. Feel free to build on top of the functionalities which you see here.

WARNING: This kit is meant for development and demonstration purposes. It is not safe for production use!

_Initial Setup_

1. Make sure you have access to the endpoints including `Watcher` and `Childchain`, address of the `Plasma Contract` and `Web3 Provider`.

1. Open up the file `omg-wallet.js` in your favorite text editor.

1. Replace the current configuration in `omg-wallet.js` with your endpoints for WEB3_PROVIDER_URL, WATCHER_URL, CHILDCHAIN_URL, PLASMA_CONTRACT_ADDRESS.

1. Save the `omg-wallet.js`.


_Usage_

1. Open up your browser and navigate to the `index.html`

2. Click on `Create new wallet`.

3. Ensure that you write down your seed phrase somewhere safe and enter in a password.

4. Send some ETH to your newly generated browser wallet from Metamask or whichever wallet you have.

5. Optional: Send some ERC20 tokens to your newly generated browser wallet.

6. Deposit into the OmiseGO Network: Here you will have to wait for a little bit. Keep refreshing via the `refresh` button. After a while, your balance will be updated.

7. Make a transfer on the OmiseGO Network: Fill in the values for the `Transfer` fields and click `Send`. Depending on the network congestion, you may have to wait for a little while for the transaction to be included in a block. Click on the `Refresh balances` button until your balance has been properly reflected.

8. Exit the funds: Fill in an address that has funds in the OmiseGO Network and click on `Exit`.
