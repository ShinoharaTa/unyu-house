<script lang="ts">
  import { onMount } from "svelte";
  let theme: string | null = null;
  onMount(() => {
    theme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });
</script>

<!-- Header -->
<!-- SideMenu -->
<!-- TimeLine -->
<!-- PostModal -->
{#if theme}
  <div data-bs-theme={theme}>
    <!-- <Header />
    <Sidebar /> -->
    <slot />
  </div>
{/if}
