<script lang="ts">
  import { onMount } from "svelte";

  onMount(() => {
    console.log("Component mounted");
  });
</script>

<div>
  <h1>Welcome to the App Page</h1>
  <p>This is the main application page.</p>
</div>

<style>
  div {
    padding: 1rem;
    font-family: Arial, sans-serif;
  }

  h1 {
    color: #2c3e50;
  }

  p {
    color: #34495e;
  }
</style>
