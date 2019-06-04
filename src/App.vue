<!-- 
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
 -->

<template>
  <div id="app">
    <div v-if="hasWeb3">
      <div class="md-layout md-gutter">
        <div class="md-layout-item md-layout md-gutter">
        <img class="logo" src='../assets/OmiseGO_Logo.svg' />
          <md-card>
            <md-card-header>
              <md-card-header-text>
                <div class="md-title">Account</div>
              </md-card-header-text>
            </md-card-header>
            <div class="md-layout-item"><b>Wallet Address:</b> {{ activeAccount.address }} </div>
            <div class="md-layout-item">
              <b>Rootchain Balance:</b>
                <span class="balance">{{ activeAccount.rootBalance }} wei</span> 
            </div>
            <div class="md-layout-item">
              <b>Childchain Balance:</b> 
              <div v-for="balance in activeAccount.childBalance">
                <span class="balance">{{ balance.amount }} {{ balance.symbol }} {{balance.currency}}</span>
              </div>
            </div>
            <div class="md-layout-item">
              <md-button class="md-raised" v-on:click="refresh">Refresh Balance</md-button>
            </div>
          </md-card>
          <md-card>
            <md-card-header>
              <md-card-header-text>
                <div class="md-title">Actions</div>
              </md-card-header-text>
            </md-card-header>
            <div>
              <div class="md-layout md-gutter md-alignment-center-center"> 
                <md-button v-on:click="toggleDeposit" class="md-raised md-primary action">Deposit</md-button>
                <md-button v-on:click="toggleTransfer" class="md-raised md-primary action">Transfer</md-button>
                <md-button v-on:click="toggleExit" class="md-raised md-primary action">Exit</md-button>
              </div>
            </div>
          </md-card>
        </div>

        <div class="md-layout-item md-layout md-gutter">
          <md-card>
            <div v-if="transactions.length">
              <md-card-header>
                <md-card-header-text>
                  <div class="md-title">Transaction History</div>
                </md-card-header-text>
              </md-card-header>
              <md-content class="md-scrollbar">
                <div class="md-layout-item" v-for="transaction in transactions">
                  <span class="date"><b>Date:</b> {{ new Date(transaction.block.timestamp * 1000).toLocaleString() }}</span>
                  <span class="txhash"><b>Transaction Hash:</b> {{ transaction.txhash }}</span>
                  <div class="result" v-for="result in transaction.results">
                    <div class="txhash"><b>Currency:</b> {{ result.currency }}</div>
                    <div class="txhash"><b>Value:</b> {{ result.value }}</div>
                  </div>
                </div>
              </md-content>
            </div>
          </md-card>
        </div>
      </div>
      <EventLog ref="eventLog"/>

      <Deposit
        v-if="isShowDeposit"
        v-on:close="toggleDeposit()"
        v-bind:OmgUtil="OmgUtil"
        v-bind:rootChain="rootChain"
        v-bind:activeAccount="activeAccount"
        v-bind:plasmaContractAddress="plasmaContractAddress"
      />

      <Transfer
        v-if="isShowTransfer"
        v-on:close="toggleTransfer()"
        v-bind:OmgUtil="OmgUtil"
        v-bind:childChain="childChain"
        v-bind:rootChain="rootChain"
        v-bind:activeAccount="activeAccount"
      />

      <Exit
        v-if="isShowExit"
        v-on:close="toggleExit()"
        v-bind:rootChain="rootChain"
        v-bind:childChain="childChain"
        v-bind:activeAccount="activeAccount"
        v-bind:utxos="utxos"
      />
    </div>
    <div v-else class="load-wallet">
      <h2>Enable MetaMask to continue...</h2>
    </div>
  </div>
</template>

<script>
import EventLog from "./EventLog.vue"
import modal from "./Modal.vue"
import Deposit from "./Deposit.vue"
import Transfer from "./Transfer.vue"
import Exit from "./Exit.vue"
import omgNetwork from "./omg-network"
import config from "./config"
import ChildChain from "@omisego/omg-js-childchain"
import RootChain from "@omisego/omg-js-rootchain"
import OmgUtil from "@omisego/omg-js-util"
import Web3 from "web3"

const web3Options = { transactionConfirmationBlocks: 1 }

async function initWeb3() {
  if (ethereum) {
    web3 = new Web3(ethereum, null, web3Options)
    try {
      // Request account access
      await ethereum.enable()
      return true
    } catch (err) {
      // User denied account access :(
      console.error(err)
    }
  } else if (web3) {
    web3 = new Web3(web3.currentProvider, null, web3Options)
    return true
  }
  // No web3...
  return false
}

export default {
  name: "app",
  components: {
    EventLog,
    modal,
    Deposit,
    Transfer,
    Exit
  },
  data() {
    return {
      hasWeb3: false,
      isShowDeposit: false,
      isShowExit: false,
      isShowTransfer: false,
      rootChain: {},
      childChain: {},
      OmgUtil: OmgUtil,
      activeAccount: {},
      plasmaContractAddress: config.plasmaContractAddress,
      utxos: [],
      transactions: [],
    }
  },
  mounted() {
    this.init()
  },
  methods: {
    info: function(message) {
      console.log(message)
      this.$refs.eventLog.info(message)
    },
    error: function(message) {
      console.error(message)
      this.$refs.eventLog.error(message)
    },
    init: async function() {
      if (!(await initWeb3())) {
        return
      }

      this.hasWeb3 = true

      try {
        this.rootChain = new RootChain(web3, config.plasmaContractAddress)
        this.childChain = new ChildChain(config.watcherUrl)

        const accounts = await omgNetwork.getAccounts(web3)
        this.activeAccount = accounts[0]
        
        this.refresh()
      } catch (err) {
        this.error(err)
      }
    },

    refresh: function() {
      omgNetwork.getBalances(this.childChain, this.activeAccount, web3)
      omgNetwork.getUtxos(this.childChain, this.activeAccount).then(utxos => this.utxos = utxos)
      omgNetwork.getTransactions(this.childChain, this.activeAccount).then(txs => this.transactions = txs)
    },

    toggleDeposit() {
      this.isShowDeposit = !this.isShowDeposit
    },
    toggleTransfer() {
      this.isShowTransfer = !this.isShowTransfer
    },
    toggleExit() {
      this.isShowExit = !this.isShowExit
    }
  }
}

</script>

<style>

span.balance {
  display: block;

}

img.logo {
  height: 60px;
  margin-left: 20px;
  margin-top: 20px;
}

.md-layout-item { 
  width: 100%; 
  height: 100%; 
  display: block; 
  margin: 20px;
  content: " "; 
}

.md-content {
    max-width: 600px;
    max-height: 700px;
    overflow: auto;
  }

.md-card-header-text > .md-title{
  font-weight: 900;
}

.action {
  margin: 20px;
  background-color: blue;
  color: white;
  font-weight: 500;
}

.md-card {
  margin: 20px;
}

body {
  font-family: Verdana, Geneva, Tahoma, sans-serif;
  color: black;
}
h2 {
  text-align: center;
  margin: 8px;
} 

.childchain-balance-header {
  font-size: 20;
  text-align: center;
  margin-bottom: 8px;
}

.transaction {
  padding: 6px;
}

.txhash {
  display: block;
}

.transaction .txhash {
  font-size: 10pt;
}

.transaction .date {
  font-size: 10pt;
}

.transaction .result {
  display: inline-block;
}

.popup-from-address {
  font-size: 10pt;
  margin-bottom: 10px;
}
.popup-input {
  text-align: right;
  margin-bottom: 10px;
}
.popup-input input {
  width: 200px;
}
.popup-input select {
  width: 200px;
}

</style>
