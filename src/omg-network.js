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
const { transaction } = require('@omisego/omg-js-util')
const numberToBN = require('number-to-bn')

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
        if (balance.currency === transaction.ETH_CURRENCY) {
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

  transfer: async function (web3, childChain, from, to, amount, currency, contract) {
    const transferZeroFee = currency !== transaction.ETH_CURRENCY
    const utxos = await childChain.getUtxos(from)
    const utxosToSpend = this.selectUtxos(
      utxos,
      amount,
      currency,
      transferZeroFee
    )
    if (!utxosToSpend) {
      throw new Error(`No utxo big enough to cover the amount ${amount}`)
    }

    const txBody = {
      inputs: utxosToSpend,
      outputs: [{
        owner: to,
        currency,
        amount: amount.toString()
      }]
    }

    const bnAmount = numberToBN(utxosToSpend[0].amount)
    if (bnAmount.gt(numberToBN(amount))) {
      // Need to add a 'change' output
      const CHANGE_AMOUNT = bnAmount.sub(numberToBN(amount))
      txBody.outputs.push({
        owner: from,
        currency,
        amount: CHANGE_AMOUNT
      })
    }

    if (transferZeroFee && utxosToSpend.length > 1) {
      // The fee input can be returned
      txBody.outputs.push({
        owner: from,
        currency: utxosToSpend[utxosToSpend.length - 1].currency,
        amount: utxosToSpend[utxosToSpend.length - 1].amount
      })
    }

    // Get the transaction data
    const typedData = transaction.getTypedData(txBody, contract)

    // We should really sign each input separately but in this we know that they're all
    // from the same address, so we can sign once and use that signature for each input.
    //
    // const sigs = await Promise.all(utxosToSpend.map(input => signTypedData(web3, web3.utils.toChecksumAddress(from), typedData)))
    //
    const signature = await signTypedData(
      web3,
      web3.utils.toChecksumAddress(from),
      JSON.stringify(typedData)
    )
    const sigs = new Array(utxosToSpend.length).fill(signature)

    // Build the signed transaction
    const signedTx = childChain.buildSignedTransaction(typedData, sigs)
    // Submit the signed transaction to the childchain
    return childChain.submitTransaction(signedTx)
  },

  selectUtxos: function (utxos, amount, currency, includeFee) {
    // Filter by desired currency and sort in descending order
    const sorted = utxos
      .filter(utxo => utxo.currency === currency)
      .sort((a, b) => numberToBN(b.amount).sub(numberToBN(a.amount)))

    if (sorted) {
      const selected = []
      let currentBalance = numberToBN(0)
      for (let i = 0; i < Math.min(sorted.length, 4); i++) {
        selected.push(sorted[i])
        currentBalance.iadd(numberToBN(sorted[i].amount))
        if (currentBalance.gte(numberToBN(amount))) {
          break
        }
      }

      if (currentBalance.gte(numberToBN(amount))) {
        if (includeFee) {
          // Find the first ETH utxo (that's not selected)
          const ethUtxos = utxos.filter(
            utxo => utxo.currency === transaction.ETH_CURRENCY
          )
          const feeUtxo = ethUtxos.find(utxo => utxo !== selected)
          if (!feeUtxo) {
            throw new Error(`Can't find a fee utxo for transaction`)
          } else {
            selected.push(feeUtxo)
          }
        }
        return selected
      }
    }
  },

  deposit: async function (web3, rootChain, from, value, currency, approveDeposit) {
    // Create the deposit transaction
    const depositTx = transaction.encodeDeposit(
      from,
      value,
      currency
    )

    if (currency === transaction.ETH_CURRENCY) {
      // ETH deposit
      return rootChain.depositEth(depositTx, value, { from })
    }

    // ERC20 token deposit
    if (approveDeposit) {
      // First approve the plasma contract on the erc20 contract
      const erc20 = new web3.eth.Contract(erc20abi, currency)
      // const approvePromise = Promise.promisify(erc20.approve.sendTransaction)

      // TODO
      const gasPrice = 1000000
      const receipt = await erc20.methods.approve(
        rootChain.plasmaContractAddress,
        value
      ).send(
        { from, gasPrice, gas: 2000000 }
      )
      // Wait for the approve tx to be mined
      console.info(`${value} erc20 approved: ${receipt.transactionHash}. Waiting for confirmation...`)
      await confirmTransaction(web3, receipt.transactionHash)
      console.info(`... ${receipt.transactionHash} confirmed.`)
    }

    return rootChain.depositToken(depositTx, { from })
  },

  exitUtxo: async function (rootChain, childChain, from, utxoToExit) {
    const exitData = await childChain.getExitData(utxoToExit)

    return rootChain.startStandardExit(
      Number(exitData.utxo_pos.toString()),
      exitData.txbytes,
      exitData.proof,
      { from }
    )
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
