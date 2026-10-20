<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { JWheelPicker } from 'j-wheel-picker';
import 'j-wheel-picker/css';

const props = defineProps({ modelValue: { type: String, default: '' } });
const emit = defineEmits(['update:modelValue', 'select']);
const input = ref(null);
let picker;

onMounted(() => {
  picker = new JWheelPicker({
    target: input.value,
    onSelect(date) {
      emit('update:modelValue', date.formatted);
      emit('select', date);
    },
  });
});

watch(() => props.modelValue, value => {
  if (input.value && input.value.value !== value) input.value.value = value;
});

onBeforeUnmount(() => picker?.destroy());
</script>

<template>
  <input ref="input" :value="modelValue" readonly placeholder="YYYY/MM/DD" aria-haspopup="dialog" />
</template>
