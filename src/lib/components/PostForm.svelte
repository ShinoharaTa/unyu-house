{#if currentChannelId && loginPubkey}
  {@const channel = channels.find(
    (channel) => channel.event.id === currentChannelId
  )}
  {#if channel !== undefined}
    <div id="input" class="show" on:click|stopPropagation={() => {}}>
      <textarea
        id="input-text"
        bind:value={inputText}
        disabled={!loginPubkey}
      />
      <button
        on:click={() => {
          callSendMessage(channel.event);
        }}
        disabled={!loginPubkey || !inputText}>Post</button
      >
    </div>
    <button id="show-post-bar" on:click|stopPropagation={showPostBar}
      ><svg><use xlink:href="/pencil-create.svg#pencil" /></svg></button
    >
  {/if}
{/if}
