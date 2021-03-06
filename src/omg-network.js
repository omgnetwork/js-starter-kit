/*
Copyright 2019 OmiseGO Pte Ltd

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License. 
 */

const erc20abi = require('human-standard-token-abi')
const { OmgUtil } = require('@omisego/omg-js')
const numberToBN = require('number-to-bn')
const BN = require('bn.js')
const JSONBigNumber = require('json-bigint')

const omgNetwork = {
  getAccounts: async function (web3) {
    const accounts = await web3.eth.getAccounts()
    return accounts.map(address => ({
      address,
      rootBalance: 0,
      childBalance: 0
    }))
  },

  getUtxos: async function (childChain, account) {
    return childChain.getUtxos(account.address)
  },

  getTransactions: async function (childChain, account) {
    return childChain.getTransactions({
      address: account.address
    })
  },

  getBalances: async function (childChain, account, web3) {
    account.rootBalance = await web3.eth.getBalance(account.address)

    const childchainBalance = await childChain.getBalance(account.address)
    account.childBalance = await Promise.all(childchainBalance.map(
      async (balance) => {
        if (balance.currency === OmgUtil.transaction.ETH_CURRENCY) {
          balance.symbol = 'wei'
        } else {
          const tokenContract = new web3.eth.Contract(erc20abi, balance.currency)
          try {
            balance.symbol = await tokenContract.methods.symbol().call()
          } catch (err) {
            balance.symbol = 'Unknown ERC20'
          }
        }
        return balance
      }
    ))
  },

  processExits: async function (web3, rootChain, from, maxExitsToProcess, currency) {
    return rootChain.processExits({
      token: currency,
      exitId: 0,
      maxExitsToProcess,
      txOptions: {
        from,
        gas: 6000000
      }
    })
  },

  transfer: async function (web3, childChain, from, to, amount, currency, contract, feeToken, feeAmount, metadata) {
    const payments = [{
      owner: to,
      currency,
      amount: Number(amount)
    }]
    const fee = {
      currency: feeToken,
      amount: Number(feeAmount)
    }
    const _metadata = metadata ? OmgUtil.transaction.encodeMetadata(metadata) : OmgUtil.transaction.NULL_METADATA
    const createdTx = await childChain.createTransaction({
      owner: from,
      payments,
      fee,
      metadata: _metadata
    })

    // if erc20 only inputs, add empty eth input to cover the fee
    if (!createdTx.transactions[0].inputs.find(i => i.currency === OmgUtil.transaction.ETH_CURRENCY)) {
      const utxos = await childChain.getUtxos(from)
      const sorted = utxos
        .filter(utxo => utxo.currency === OmgUtil.transaction.ETH_CURRENCY)
        .sort((a, b) => numberToBN(b.amount).sub(numberToBN(a.amount)))
      // return early if no utxos
      if (!sorted || !sorted.length) {
        throw new Error(`No ETH utxo available to cover the fee amount`)
      }
      const ethUtxo = sorted[0]
      const emptyOutput = {
        amount: ethUtxo.amount,
        currency: ethUtxo.currency,
        owner: ethUtxo.owner
      }
      createdTx.transactions[0].inputs.push(ethUtxo)
      createdTx.transactions[0].outputs.push(emptyOutput)
    }

    const typedData = OmgUtil.transaction.getTypedData(createdTx.transactions[0], contract)
    // We should really sign each input separately but in this we know that they're all
    // from the same address, so we can sign once and use that signature for each input.
    const signature = await signTypedData(
      web3,
      web3.utils.toChecksumAddress(from),
      JSONBigNumber.stringify(typedData)
    )
    const signatures = new Array(createdTx.transactions[0].inputs.length).fill(signature)
    const signedTxn = childChain.buildSignedTransaction(typedData, signatures)
    const submitted = await childChain.submitTransaction(signedTxn)

    // using submit typed...
    // const signTyped = await childChain.signTypedData(createdTx.transactions[0], ['3C1FEC09834B23FFAC9A773D1FC3F03E859F5163E1FEDC0EDFE3FED325B47A62'])
    // const submitted = await childChain.submitTyped(signTyped)

    return submitted
  },


  deposit: async function (web3, rootChain, from, value, currency, approveDeposit) {
    const depositTx = OmgUtil.transaction.encodeDeposit(from, new BN(value), currency)

    // ETH deposit
    if (currency === OmgUtil.transaction.ETH_CURRENCY) {
      return rootChain.depositEth({
        depositTx,
        amount: new BN(value),
        txOptions: { from, gas: 6000000 }
      })
    }

    // ERC20 token deposit
    if (approveDeposit) {
      // First approve the erc20 vault on the erc20 contract
      const receipt = await rootChain.approveToken({
        erc20Address: currency,
        amount: value,
        txOptions: { from, gas: 6000000 }
      })
      // Wait for the approve tx to be mined
      console.info(`${value} erc20 approved: ${receipt.transactionHash}. Waiting for confirmation...`)
      await confirmTransaction(web3, receipt.transactionHash)
      console.info(`... ${receipt.transactionHash} confirmed.`)
    }

    return rootChain.depositToken({ depositTx, txOptions: { from, gas: 6000000 } })
  },

  exitUtxo: async function (rootChain, childChain, from, utxoToExit) {
    const exitData = await childChain.getExitData(utxoToExit)
    const hasToken = await rootChain.hasToken(utxoToExit.currency)
    if (!hasToken) {
      console.log('adding to exit queue...')
      await rootChain.addToken({
        token: utxoToExit.currency,
        txOptions: { from, gas: 6000000 }
      })
    }

    console.log('starting standard exit...')
    return rootChain.startStandardExit({
      utxoPos: exitData.utxo_pos,
      outputTx: exitData.txbytes,
      inclusionProof: exitData.proof,
      txOptions: { from, gas: 6000000 }
    })
  }
}

function signTypedData (web3, signer, data) {
  return web3.currentProvider.send('eth_signTypedData_v3', [signer, data])
}

const DEFAULT_INTERVAL = 1000
const DEFAULT_BLOCKS_TO_WAIT = 1

function confirmTransaction (web3, txnHash, options) {
  const interval = options && options.interval ? options.interval : DEFAULT_INTERVAL
  const blocksToWait = options && options.blocksToWait ? options.blocksToWait : DEFAULT_BLOCKS_TO_WAIT
  var transactionReceiptAsync = async function (txnHash, resolve, reject) {
    try {
      var receipt = await web3.eth.getTransactionReceipt(txnHash)
      if (!receipt) {
        setTimeout(function () {
          transactionReceiptAsync(txnHash, resolve, reject)
        }, interval)
      } else {
        if (blocksToWait > 0) {
          var resolvedReceipt = await receipt
          if (!resolvedReceipt || !resolvedReceipt.blockNumber) {
            setTimeout(function () {
              transactionReceiptAsync(txnHash, resolve, reject)
            }, interval)
          } else {
            try {
              var block = await web3.eth.getBlock(resolvedReceipt.blockNumber)
              var current = await web3.eth.getBlock('latest')
              if (current.number - block.number >= blocksToWait) {
                var txn = await web3.eth.getTransaction(txnHash)
                if (txn.blockNumber != null) {
                  resolve(resolvedReceipt)
                } else {
                  reject(new Error('Transaction with hash: ' + txnHash + ' ended up in an uncle block.'))
                }
              } else {
                setTimeout(function () {
                  transactionReceiptAsync(txnHash, resolve, reject)
                }, interval)
              }
            } catch (e) {
              setTimeout(function () {
                transactionReceiptAsync(txnHash, resolve, reject)
              }, interval)
            }
          }
        } else resolve(receipt)
      }
    } catch (e) {
      reject(e)
    }
  }

  if (Array.isArray(txnHash)) {
    var promises = []
    txnHash.forEach(function (oneTxHash) {
      promises.push(confirmTransaction(web3, oneTxHash, options))
    })
    return Promise.all(promises)
  } else {
    return new Promise(function (resolve, reject) {
      transactionReceiptAsync(txnHash, resolve, reject)
    })
  }
}

module.exports = omgNetwork
