
const WEB3_PROVIDER_URL = 'https://rinkeby.infura.io/'
const WATCHER_URL = ''
const CHILDCHAIN_URL = ''
const PLASMA_CONTRACT_ADDRESS = ''

var web3 = new Web3()
let globalKeystore
let rootChain
let childChain

function createVault (password, seed) {
  lightwallet.keystore.createVault({
    password: password,
    seedPhrase: seed,
    hdPathString: "m/0'/0'/0'"
  }, function (err, keystore) {
    if (err) {
      console.error(err)
      return
    }

    globalKeystore = keystore

    const web3Provider = new HookedWeb3Provider({
      host: WEB3_PROVIDER_URL,
      transaction_signer: globalKeystore
    })
    web3.setProvider(web3Provider)

    rootChain = new RootChain(web3, PLASMA_CONTRACT_ADDRESS)
    childChain = new ChildChain(WATCHER_URL, CHILDCHAIN_URL)

    newAddress(password)
  })
}

function newWallet () {
  var randomSeed = lightwallet.keystore.generateRandomSeed()

  var infoString = 'Your new wallet seed is: "' + randomSeed +
    '". Please write it down on paper or in a password manager, you will need it to access your wallet. ' +
    'Please enter a password to encrypt your seed while in the browser.'

  var password = prompt(infoString, 'Password')
  createVault(password, randomSeed)
  showWalletUI()
}

function restoreSeed () {
  var password = prompt('Enter Password to encrypt your seed', 'Password')
  createVault(password, document.getElementById('seed').value)
  document.getElementById('seed').value = ''
  showWalletUI()
}

function newAddress (password) {
  if (password === '') {
    password = prompt('Enter password', 'Password')
  }

  globalKeystore.keyFromPassword(password, function (err, pwDerivedKey) {
    if (err) {
      console.error(err)
      return
    }

    // Show the first 2 addresses in the wallet
    globalKeystore.generateNewAddress(pwDerivedKey, 2)
    showBalances()
  })
}

async function showBalances () {
  var addresses = globalKeystore.getAddresses()
  document.getElementById('rootchainBalance').innerHTML = 'Retrieving addresses...'

  if (addresses.length > 0) {
    document.getElementById('rootchainBalance').innerHTML = ''
    document.getElementById('childchainBalance').innerHTML = ''
    addresses.forEach(async (address) => {
      web3.eth.getBalance(address, (err, ethBalance) => {
        if (err) {
          console.error(err)
          return
        }
        document.getElementById('rootchainBalance').innerHTML += '<div>' + address + ': ' + (ethBalance / 1.0e18) + ' ETH </div>'
      })
      childChain.getBalance(address).then(childchainBalance => {
        document.getElementById('childchainBalance').innerHTML += '<div>' + address + ': ' + JSON.stringify(childchainBalance) + '</div>'
      })
    })
  }
}

function showSeed () {
  var password = prompt('Enter password to show your seed. Do not let anyone else see your seed.', 'Password')

  globalKeystore.keyFromPassword(password, function (err, pwDerivedKey) {
    if (err) {
      console.error(err)
      return
    }
    var seed = globalKeystore.getSeed(pwDerivedKey)
    alert('Your seed is: "' + seed + '". Please write it down.')
  })
}

function showWalletUI () {
  document.getElementById('addressArea').style.display = 'block'
  document.getElementById('functionArea').style.display = 'block'
}

function deposit () {
  var fromAddr = document.getElementById('depositFromAddress').value
  var value = document.getElementById('depositValue').value
  var tokenContract = document.getElementById('depositContractAddress').value
  tokenContract = tokenContract || OmgUtil.transaction.ETH_CURRENCY

  // Create the deposit transaction
  const depositTx = OmgUtil.transaction.encodeDeposit(fromAddr, value, tokenContract)
  console.log(depositTx)

  if (tokenContract === OmgUtil.transaction.ETH_CURRENCY) {
    rootChain.depositEth(depositTx, value, { from: fromAddr })
      .then(txhash => {
        console.log('txhash: ' + txhash.transactionHash)
      })
      .catch(console.error)
  } else {
    rootChain.depositToken(depositTx, { from: fromAddr })
      .then(txhash => {
        console.log('txhash: ' + txhash.transactionHash)
      })
  }
}

async function childchainTransfer () {
  var fromAddr = document.getElementById('transferFromAddress').value
  var toAddr = document.getElementById('transferToAddress').value
  var tokenContract = document.getElementById('transferContractAddress').value
  tokenContract = tokenContract || OmgUtil.transaction.ETH_CURRENCY
  var value = document.getElementById('transferValue').value

  const utxos = await childChain.getUtxos(fromAddr)
  const utxosToSpend = selectUtxos(utxos, value, tokenContract)
  if (!utxosToSpend) {
    alert(`No utxo big enough to cover the amount ${value}`)
    return
  }

  const txBody = {
    inputs: utxosToSpend,
    outputs: [{
      owner: toAddr,
      currency: tokenContract,
      amount: Number(value)
    }]
  }

  if (new BigNumber(utxosToSpend[0].amount).gt(new BigNumber(value))) {
    // Need to add a 'change' output
    const CHANGE_AMOUNT = new BigNumber(utxosToSpend[0].amount).minus(new BigNumber(value))
    txBody.outputs.push({
      owner: fromAddr,
      currency: tokenContract,
      amount: CHANGE_AMOUNT
    })
  }

  // Create the unsigned transaction
  const unsignedTx = childChain.createTransaction(txBody)

  const password = prompt('Enter password', 'Password')

  // Sign it
  globalKeystore.keyFromPassword(password, async function (err, pwDerivedKey) {
    if (err) {
      console.error(err)
      return
    }
    // Decrypt the private key
    const privateKey = globalKeystore.exportPrivateKey(fromAddr, pwDerivedKey)
    // Sign the transaction with the private key
    const signatures = await childChain.signTransaction(unsignedTx, [privateKey])
    // Build the signed transaction
    const signedTx = await childChain.buildSignedTransaction(unsignedTx, signatures)
    // Submit the signed transaction to the childchain
    const result = await childChain.submitTransaction(signedTx)
    console.log(`Submitted transaction: ${JSON.stringify(result)}`)
  })
}

function selectUtxos (utxos, amount, currency) {
  const correctCurrency = utxos.filter(utxo => utxo.currency === currency)
  // Just find the first utxo that can fulfill the amount
  const selected = correctCurrency.find(utxo => new BigNumber(utxo.amount).gte(new BigNumber(amount)))
  if (selected) {
    return [selected]
  }
}

async function startStandardExit () {
  var fromAddr = document.getElementById('exitFromAddress').value

  const utxos = await childChain.getUtxos(fromAddr)
  if (utxos.length > 0) {
    // NB This only exits the first UTXO.
    // Selecting _which_ UTXO to exit is left as an exercise for the reader...
    const exitData = await childChain.getExitData(utxos[0])

    let receipt = await rootChain.startStandardExit(
      exitData.utxo_pos.toString(),
      exitData.txbytes,
      exitData.proof,
      {
        from: fromAddr
      }
    )
    console.log(`RootChain.startExit(): txhash = ${receipt.transactionHash}`)
  }
}
