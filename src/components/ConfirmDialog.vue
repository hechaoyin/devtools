<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()

function onKey(e: KeyboardEvent) {
  if (!ui.confirm) return
  if (e.key === 'Escape') ui.closeConfirm()
  else if (e.key === 'Enter') accept()
}

function accept() {
  const req = ui.confirm
  ui.closeConfirm()
  req?.onConfirm()
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Transition name="fade">
    <div v-if="ui.confirm" class="overlay" data-testid="confirm-dialog" @mousedown.self="ui.closeConfirm" @contextmenu.prevent>
      <div class="dialog glass" role="alertdialog" :aria-label="ui.confirm.title">
        <h2>{{ ui.confirm.title }}</h2>
        <p class="dim">{{ ui.confirm.message }}</p>
        <div class="actions">
          <button class="btn" data-testid="confirm-cancel" @click="ui.closeConfirm">取消</button>
          <button class="btn btn-primary" :class="{ 'btn-destructive': ui.confirm.danger }" data-testid="confirm-ok" @click="accept">
            {{ ui.confirm.confirmLabel ?? '好' }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 99000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.18);
}
.dialog {
  width: 320px;
  padding: 20px 22px 16px;
  border-radius: 14px;
  background: var(--menu-bg);
  border: 0.5px solid var(--border);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
h2 {
  margin: 0;
  font-size: 14px;
}
p {
  margin: 0;
  line-height: 1.55;
}
.dim {
  color: var(--text-dim);
  font-size: 12.5px;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
}
.btn-destructive {
  background: #ff453a;
}
.btn-destructive:hover:not(:disabled) {
  background: #ff5f55;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
