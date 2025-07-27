export const GET = async ({ fetch }: { fetch: any }) => {
  // Set up Server-Sent Events headers
  const headers = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  };

  // Create a readable stream for Server-Sent Events
  const stream = new ReadableStream({
    start(controller) {
      let intervalId: any;
      let heartbeatId: any;
      let isClosed = false;
      
      // Function to send scoreboard data
      const sendScoreboardUpdate = async () => {
        if (isClosed) return;
        
        try {
          // Get latest scoreboard data from our own API
          const response = await fetch('http://localhost:8080/api/scoreboard', {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Internal/Event-Feed'
            }
          });
          
          if (response.ok && !isClosed) {
            const data = await response.json();
            
            // Send as Server-Sent Event
            const eventData = `data: ${JSON.stringify({
              type: 'scoreboard_update',
              timestamp: new Date().toISOString(),
              data: data
            })}\n\n`;
            
            try {
              controller.enqueue(new TextEncoder().encode(eventData));
            } catch (error) {
              console.error('Controller error:', error);
              isClosed = true;
              if (intervalId) clearInterval(intervalId);
              if (heartbeatId) clearInterval(heartbeatId);
            }
          }
        } catch (error) {
          console.error('Error fetching scoreboard for event feed:', error);
        }
      };

      // Send initial data immediately
      sendScoreboardUpdate();

      // Send updates every 5 seconds (more frequent than polling)
      intervalId = setInterval(sendScoreboardUpdate, 5000);

      // Send heartbeat every 30 seconds to keep connection alive
      heartbeatId = setInterval(() => {
        if (isClosed) return;
        
        try {
          const heartbeat = `data: ${JSON.stringify({
            type: 'heartbeat',
            timestamp: new Date().toISOString()
          })}\n\n`;
          controller.enqueue(new TextEncoder().encode(heartbeat));
        } catch (error) {
          // Controller is probably closed
          isClosed = true;
          if (intervalId) clearInterval(intervalId);
          if (heartbeatId) clearInterval(heartbeatId);
        }
      }, 30000);

      // Cleanup function
      return () => {
        isClosed = true;
        if (intervalId) clearInterval(intervalId);
        if (heartbeatId) clearInterval(heartbeatId);
      };
    },
    
    cancel() {
      console.log('Event stream cancelled');
    }
  });

  return new Response(stream, { headers });
};
