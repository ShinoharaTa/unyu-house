<script lang="ts">
  export let title: string;
  const onClickMenuButton = () => {
	// layout へemitする
  };
</script>

<header class="navbar navbar-expand-lg bg-body-tertiary">
  <div class="container-fluid justify-content-start">
    <button on:click={onClickMenuButton} class="menuToggle"
      ><svg><use xlink:href="/menu.svg#hamburger" /></svg></button
    >
    <a class="navbar-brand" href="/">{title}</a>
  </div>
</header>

<style>
  svg {
    width: 20px;
    height: 20px;
	fill: #fff;
  }
  .menuToggle {
    border: none;
    background: none;
    display: flex;
    align-items: center;
	margin: 0px 10px
  }
</style>
