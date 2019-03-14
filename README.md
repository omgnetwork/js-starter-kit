# js-starter-kit

This is a bare minimal client side wallet written in JavaScript which allows you to make interaction with the OMG network from the browser. Before you get started, make sure you have either a local instance of `elixir-omg` or have access to an already deployed network. Feeel free to build on top of the functionalities you see here.

WARNING: this kit is meant for development and demonstration purpose, it's not safe for production use

_Initial Setup_

1. Make sure you have access to the endpoints including `Watcher` and `Childchain`, address of the `Plasma contract` and `Web3 Provider`. 


2. open up the file `omg-wallet.js` on your text editor

4. replace the current configs with your endpoints for WEB3_PROVIDER_URL, WATCHER_URL, CHILDCHAIN_URL, PLASMA_CONTRACT_ADDRESS. Then save the file.


_Usage_

1. Open up your browser and navigate to the index.html

2. click on `create wallet`, make sure you write your seed phrase somewhere

3. Send some ETH to your newly generated browser wallet from Metamask or whichever wallet you have

4. Deposit Transaction, here you will have to wait for a little bit. Keep refreshing via the `refresh` button. After a while, your balance will be updated

5. Add the inputs to the `Transfer` fields, click send. Depending on the network congestion, you might have to wait for a little bit and your transaction should go through after clicking refresh.

6. Exit the funds

