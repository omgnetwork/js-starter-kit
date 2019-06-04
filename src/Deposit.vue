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
  <modal>
    <h2 slot="header">Deposit</h2>
    <div slot="body">
      <div class="popup-from-address">
        From address:
        <span class="mono">{{ activeAccount.address }}</span>
      </div>
      <div style="display: inline-block">
        <div class="popup-input">
          Token contract address (blank for wei):
          <input v-model="depositCurrency" size="30">
        </div>
        <div class="popup-input">
          Amount
          <input v-model="depositAmount" size="30">
        </div>
        <div class="popup-input">
          approve ERC20 token before deposit
          <input type="checkbox" v-model="approveDeposit">
        </div>
      </div>
      <div>
        <md-button v-on:click="deposit(); $emit('close')" class="md-raised">Ok</md-button>
        <md-button v-on:click="$emit('close')" class="md-raised">Cancel</md-button>
      </div>
    </div>
  </modal>
</template>

<script>
import modal from "./Modal.vue"
import omgNetwork from "./omg-network"

export default {
  components: {
    modal
  },

  props: {
    OmgUtil: Object,
    activeAccount: Object,
    rootChain: Object,
    plasmaContractAddress: String
  },

  data() {
    return {
      depositCurrency: "",
      depositAmount: 0,
      approveDeposit: false
    }
  },

  methods: {
    deposit: async function() {
      try {
        const tokenContract = this.depositCurrency || this.OmgUtil.transaction.ETH_CURRENCY
        const from = this.activeAccount.address
        const value = this.depositAmount

        const tx = await omgNetwork.deposit(
          web3, 
          this.rootChain, 
          from, 
          value, 
          tokenContract,
          this.approveDeposit
        )
        this.approveDeposit = false
        this.$parent.info(`Deposited ${value} ${tokenContract === this.OmgUtil.transaction.ETH_CURRENCY ? 'wei' : tokenContract} tokens: ${tx.transactionHash}`)
      } catch (err) {
        this.$parent.error(err)
      }
    }
  }
}
</script>
