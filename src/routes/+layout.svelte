<!-- Layout for all pages -->
<script>
  // Import any global styles
  // No need to accept params here as this is the layout
</script>

<main>
  <slot />
</main>

<style>
  :global(html) {
    font-family: 'Segoe UI', 'Roboto', 'Kanit', sans-serif;
  }

  :global(body) {
    margin: 0;
    padding: 0;
    background: #f8f9fa;
  }

  main {
    width: 100%;
    min-height: 100vh;
  }
</style>
