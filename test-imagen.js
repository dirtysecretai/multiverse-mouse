// test-imagen.js
const { VertexAI } = require('@google-cloud/vertexai');

// Hardcode for testing (Next.js will load from .env.local automatically)
const projectId = 'multiverse-mouse'; // YOUR PROJECT ID
const location = 'us-central1';

console.log('Testing Vertex AI authentication...');
console.log('Project ID:', projectId);

try {
  const vertexAI = new VertexAI({
    project: projectId,
    location: location,
  });

  console.log('✅ Vertex AI initialized successfully!');
  console.log('Project:', projectId);
  console.log('Location:', location);
  console.log('\n🎉 Ready to scan universes!');
  console.log('\nGoogle Cloud setup is complete!');
} catch (error) {
  console.error('❌ Error initializing Vertex AI:', error.message);
  console.error('Full error:', error);
  process.exit(1);
}