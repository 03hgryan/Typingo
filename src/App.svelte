<script lang="ts">
  import router from "svelte-spa-router";
  import AppPage from "./routes/app/+page.svelte";

  const routes = {
    "/": AppPage,
  };
</script>

<svelte:component this={router} {routes} />
