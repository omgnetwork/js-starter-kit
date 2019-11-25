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
    <h2 slot="header">Process Exits</h2>
    <div slot="body">
      <div class="popup-from-address">
        From address:
        <span class="mono">{{ activeAccount.address }}</span>
      </div>
      <div style="display: inline-block">
        <div class="popup-input">
          Token to exit:
          <input v-model="exitToken">
        </div>
        <div class="popup-input">
          Max exits to process:
          <input v-model="maxExitsToProcess">
        </div>
      </div>
      <div>
        <md-button v-on:click="processexit(); $emit('close')" class="md-raised">Ok</md-button>
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
    rootChain: Object
  },

  data() {
    return {
      exitToken: this.OmgUtil.transaction.ETH_CURRENCY,
      maxExitsToProcess: 20
    }
  },

  methods: {
    processexit: async function() {
      const token = this.exitToken || this.OmgUtil.transaction.ETH_CURRENCY
      const fromAddr = this.activeAccount.address
      try {
        const receipt = await omgNetwork.processExits(web3, this.rootChain, fromAddr, this.maxExitsToProcess, token)
        this.$parent.info(`Process exits called: ${receipt.transactionHash}`)
      } catch (err) {
        this.$parent.error(err)
      }
    }
  }
}
</script>
