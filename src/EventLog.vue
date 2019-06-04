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
  <div v-if="logs.length" class="logs">
    <div v-for="log in logs">
      <div class="log" v-bind:class="log.level">
        {{ log.message }}
        <span @click="removeLog(log)" class="remove">X</span>
      </div>
    </div>
  </div>
</template>

<script>

const MAX_LOGS = 5

export default {
  data() {
    return {
      logs: []
    };
  },
  methods: {
    log(message) {
      if (this.logs.length >= MAX_LOGS) {
        this.logs.shift()
      }
      this.logs.push(message)
    },
    info(message) {
      this.log({ message, level: 'info' })
    },
    error(message) {
      this.log({ message, level: 'error' })
    },
    removeLog(log) {
      this.logs = this.logs.filter(item => item !== log)
    }
  }
}
</script>
