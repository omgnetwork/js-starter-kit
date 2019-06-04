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
    <h2 slot="header">Transfer</h2>
    <div slot="body">
      <div class="popup-from-address">
        From address:
        <span class="mono">{{ activeAccount.address }}</span>
      </div>
      <div style="display: inline-block">
        <div class="popup-input">
          Token:
          <select id="transferCurrency" v-model="transferCurrency">
            <option
              v-for="balance in activeAccount.childBalance"
              v-bind:value="balance.currency"
            >{{ balance.symbol != 'Unknown ERC20' ? balance.symbol : balance.currency }}</option>
          </select>
        </div>
        <div class="popup-input">
          To address:
          <input v-model="transferToAddress">
        </div>
        <div class="popup-input">
          Amount:
          <input v-model="transferAmount">
        </div>
      </div>
      <div>
        <md-button v-on:click="transfer(); $emit('close')" class="md-raised">Ok</md-button>
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
    childChain: Object,
    rootChain: Object
  },

  data() {
    return {
      transferCurrency: this.OmgUtil.transaction.ETH_CURRENCY,
      transferAmount: 0,
      transferToAddress: ''
    }
  },

  methods: {
    transfer: async function() {
      const tokenContract =
        this.transferCurrency || this.OmgUtil.transaction.ETH_CURRENCY
      const fromAddr = this.activeAccount.address
      const toAddr = this.transferToAddress
      const value = this.transferAmount

      try {
        const result = await omgNetwork.transfer(
          web3,
          this.childChain,
          fromAddr, 
          toAddr,
          value, 
          tokenContract,
          this.rootChain.plasmaContractAddress
        )
        this.$parent.info(`Submitted transaction: ${JSON.stringify(result)}`)
      } catch (err) {
        this.$parent.error(err)
      }
    },
  }
}
</script>
