// Global Variables
let trainingActive = false;
let currentEpoch = 0;
let generatorLoss = 2.5;
let discriminatorLoss = 0.7;
let lossHistory = { generator: [], discriminator: [] };
let trainingInterval = null;
let currentDataset = 'mnist';
let learningRate = 0.0002;
let noiseDimension = 100;

// Chart Canvas Context
let chartCanvas = null;
let chartCtx = null;

// Component Information Database
const componentInfo = {
    noise: {
        title: "Random Noise Vector (z)",
        description: "A random vector sampled from a latent space (usually Gaussian distribution). This noise serves as the input to the generator and determines what image will be created. Dimension typically ranges from 50-200.",
        technical: "z ~ N(0, 1) where z ∈ R^n, n is the noise dimension"
    },
    generator: {
        title: "Generator Network (G)",
        description: "A deep neural network that learns to map random noise vectors to realistic images. Uses transposed convolutions (deconvolutions) to upsample from low-dimensional noise to high-dimensional images. Includes batch normalization and LeakyReLU activations.",
        technical: "G: Z → X where Z is latent space and X is image space. Architecture: Dense → Reshape → Conv2DTranspose layers"
    },
    fake: {
        title: "Generated (Fake) Image",
        description: "The output of the generator network. Initially looks like random noise, but as training progresses, becomes increasingly realistic and indistinguishable from real images. The generator tries to create images that fool the discriminator.",
        technical: "G(z) produces images in range [-1, 1] (tanh activation)"
    },
    discriminator: {
        title: "Discriminator Network (D)",
        description: "A binary classifier that tries to distinguish between real images from the dataset and fake images from the generator. Uses convolutional layers with strided convolutions for downsampling. Acts as a critic that provides feedback to improve the generator.",
        technical: "D: X → [0, 1] where output represents probability of input being real. Uses binary cross-entropy loss."
    },
    output: {
        title: "Classification Output",
        description: "The discriminator's prediction: a probability between 0 and 1, where 1 means 'definitely real' and 0 means 'definitely fake'. During training, the generator tries to maximize this value for its generated images, while the discriminator tries to output correct classifications.",
        technical: "D(x) → probability ∈ [0, 1]. Real images: D(x) → 1, Fake images: D(G(z)) → 0"
    }
};

// Dataset Emojis for Visualization
const datasetEmojis = {
    mnist: ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'],
    fashion: ['👕', '👖', '👗', '👔', '👞', '👠', '👜', '🧥', '🥾', '👟']
};

// Initialize on Page Load
document.addEventListener('DOMContentLoaded', function() {
    initializeChart();
    setupEventListeners();
    updateDisplayValues();
    setupSmoothScroll();
});

// Setup Smooth Scroll for Navigation
function setupSmoothScroll() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                
                // Update active nav link
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                this.classList.add('active');
            }
        });
    });
}

// Update Status Badge
function updateStatusBadge(status, text) {
    const badge = document.getElementById('status-badge');
    const dot = badge.querySelector('.status-dot');
    const statusText = badge.querySelector('.status-text');
    
    badge.className = 'status-badge';
    
    if (status === 'training') {
        badge.style.background = 'rgba(239, 68, 68, 0.1)';
        badge.style.borderColor = 'rgba(239, 68, 68, 0.3)';
        badge.style.color = '#dc2626';
        dot.style.background = '#dc2626';
    } else if (status === 'complete') {
        badge.style.background = 'rgba(16, 185, 129, 0.1)';
        badge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
        badge.style.color = '#059669';
        dot.style.background = '#059669';
    } else {
        badge.style.background = 'rgba(16, 185, 129, 0.1)';
        badge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
        badge.style.color = '#059669';
        dot.style.background = '#059669';
    }
    
    statusText.textContent = text;
}

// Setup Event Listeners
function setupEventListeners() {
    // Training Controls
    document.getElementById('start-training').addEventListener('click', toggleTraining);
    document.getElementById('reset-training').addEventListener('click', resetTraining);
    document.getElementById('generate-sample').addEventListener('click', generateSample);
    
    // Dataset Selection
    document.getElementById('dataset-select').addEventListener('change', function(e) {
        currentDataset = e.target.value;
        resetTraining();
    });
    
    // Learning Rate Slider
    document.getElementById('learning-rate').addEventListener('input', function(e) {
        learningRate = parseFloat(e.target.value);
        document.getElementById('lr-value').textContent = learningRate.toFixed(5);
    });
    
    // Noise Dimension Slider
    document.getElementById('noise-dim').addEventListener('input', function(e) {
        noiseDimension = parseInt(e.target.value);
        document.getElementById('noise-value').textContent = noiseDimension;
    });
    
    // Architecture Component Clicks
    document.querySelectorAll('.flow-card').forEach(component => {
        component.addEventListener('click', function() {
            const componentType = this.getAttribute('data-component');
            showComponentInfo(componentType);
        });
    });
    
    // Code Tabs
    document.querySelectorAll('.code-tab').forEach(btn => {
        btn.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            switchTab(tabName);
        });
    });
}

// Initialize Chart Canvas
function initializeChart() {
    chartCanvas = document.getElementById('loss-chart');
    chartCtx = chartCanvas.getContext('2d');
    
    // Set canvas size
    const rect = chartCanvas.getBoundingClientRect();
    chartCanvas.width = rect.width * window.devicePixelRatio;
    chartCanvas.height = 250 * window.devicePixelRatio;
    chartCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
    
    drawChart();
}

// Draw Loss Chart
function drawChart() {
    if (!chartCtx) return;
    
    const width = chartCanvas.width / window.devicePixelRatio;
    const height = 250;
    const padding = 40;
    const graphWidth = width - 2 * padding;
    const graphHeight = height - 2 * padding;
    
    // Clear canvas
    chartCtx.clearRect(0, 0, width, height);
    
    // Draw background
    chartCtx.fillStyle = '#f9fafb';
    chartCtx.fillRect(0, 0, width, height);
    
    // Draw axes
    chartCtx.strokeStyle = '#6b7280';
    chartCtx.lineWidth = 2;
    chartCtx.beginPath();
    chartCtx.moveTo(padding, padding);
    chartCtx.lineTo(padding, height - padding);
    chartCtx.lineTo(width - padding, height - padding);
    chartCtx.stroke();
    
    // Draw labels
    chartCtx.fillStyle = '#374151';
    chartCtx.font = '12px sans-serif';
    chartCtx.fillText('Loss', 5, 20);
    chartCtx.fillText('Epoch', width - 50, height - 10);
    
    // If no data, show message
    if (lossHistory.generator.length === 0) {
        chartCtx.fillStyle = '#9ca3af';
        chartCtx.font = '14px sans-serif';
        chartCtx.textAlign = 'center';
        chartCtx.fillText('Start training to see loss curves', width / 2, height / 2);
        chartCtx.textAlign = 'left';
        return;
    }
    
    // Find max loss for scaling
    const maxLoss = Math.max(
        ...lossHistory.generator,
        ...lossHistory.discriminator,
        3.0
    );
    
    // Draw Generator Loss (Purple)
    if (lossHistory.generator.length > 1) {
        chartCtx.strokeStyle = '#8b5cf6';
        chartCtx.lineWidth = 3;
        chartCtx.beginPath();
        
        lossHistory.generator.forEach((loss, i) => {
            const x = padding + (i / (lossHistory.generator.length - 1)) * graphWidth;
            const y = height - padding - (loss / maxLoss) * graphHeight;
            
            if (i === 0) {
                chartCtx.moveTo(x, y);
            } else {
                chartCtx.lineTo(x, y);
            }
        });
        chartCtx.stroke();
    }
    
    // Draw Discriminator Loss (Blue)
    if (lossHistory.discriminator.length > 1) {
        chartCtx.strokeStyle = '#3b82f6';
        chartCtx.lineWidth = 3;
        chartCtx.beginPath();
        
        lossHistory.discriminator.forEach((loss, i) => {
            const x = padding + (i / (lossHistory.discriminator.length - 1)) * graphWidth;
            const y = height - padding - (loss / maxLoss) * graphHeight;
            
            if (i === 0) {
                chartCtx.moveTo(x, y);
            } else {
                chartCtx.lineTo(x, y);
            }
        });
        chartCtx.stroke();
    }
    
    // Draw legend
    chartCtx.font = 'bold 11px sans-serif';
    
    chartCtx.fillStyle = '#8b5cf6';
    chartCtx.fillRect(width - 180, 15, 15, 15);
    chartCtx.fillStyle = '#374151';
    chartCtx.fillText('Generator Loss', width - 160, 27);
    
    chartCtx.fillStyle = '#3b82f6';
    chartCtx.fillRect(width - 180, 35, 15, 15);
    chartCtx.fillStyle = '#374151';
    chartCtx.fillText('Discriminator Loss', width - 160, 47);
}

// Toggle Training
function toggleTraining() {
    const btn = document.getElementById('start-training');
    const btnText = btn.querySelector('span');
    
    if (!trainingActive) {
        trainingActive = true;
        btnText.textContent = 'Pause Training';
        btn.classList.remove('primary-action');
        btn.classList.add('secondary-action');
        updateStatusBadge('training', 'Training');
        startTraining();
    } else {
        trainingActive = false;
        btnText.textContent = 'Resume Training';
        btn.classList.remove('secondary-action');
        btn.classList.add('primary-action');
        updateStatusBadge('ready', 'Paused');
        stopTraining();
    }
}

// Start Training Simulation
function startTraining() {
    document.getElementById('generation-message').style.display = 'none';
    
    trainingInterval = setInterval(() => {
        currentEpoch++;
        
        // Simulate loss convergence
        const convergenceRate = learningRate * 1000;
        const noiseImpact = (200 - noiseDimension) / 1000;
        
        // Generator loss should decrease
        generatorLoss = Math.max(
            0.5,
            generatorLoss - (Math.random() * 0.1 * convergenceRate) - noiseImpact
        );
        
        // Discriminator loss should stabilize around 0.7
        discriminatorLoss = 0.7 + (Math.random() - 0.5) * 0.3;
        
        // Store loss history
        lossHistory.generator.push(generatorLoss);
        lossHistory.discriminator.push(discriminatorLoss);
        
        // Update display
        updateTrainingDisplay();
        drawChart();
        
        // Generate samples periodically
        if (currentEpoch % 5 === 0) {
            generateSample();
        }
        
        // Stop at epoch 100
        if (currentEpoch >= 100) {
            stopTraining();
            const btn = document.getElementById('start-training');
            const btnText = btn.querySelector('span');
            btnText.textContent = 'Training Complete ✓';
            btn.disabled = true;
            updateStatusBadge('complete', 'Complete');
        }
    }, 500); // Update every 500ms
}

// Stop Training
function stopTraining() {
    if (trainingInterval) {
        clearInterval(trainingInterval);
        trainingInterval = null;
    }
}

// Update Training Display
function updateTrainingDisplay() {
    document.getElementById('epoch-count').textContent = currentEpoch;
    document.getElementById('gen-loss').textContent = generatorLoss.toFixed(2);
    document.getElementById('disc-loss').textContent = discriminatorLoss.toFixed(2);
    
    // Calculate quality score based on loss
    const qualityScore = Math.min(100, Math.max(0, (2.5 - generatorLoss) / 2.0 * 100));
    document.getElementById('quality-score').textContent = Math.round(qualityScore) + '%';
}

// Generate Sample Images
function generateSample() {
    const imageGrid = document.getElementById('image-grid');
    const emojis = datasetEmojis[currentDataset];
    
    // Clear existing images if more than 8
    while (imageGrid.children.length >= 8) {
        imageGrid.removeChild(imageGrid.firstChild);
    }
    
    // Add new generated image
    const imageDiv = document.createElement('div');
    imageDiv.className = 'generated-image';
    
    // Select emoji based on quality
    const qualityScore = (2.5 - generatorLoss) / 2.0;
    let emoji;
    
    if (qualityScore < 0.3) {
        emoji = '❓'; // Poor quality
    } else if (qualityScore < 0.6) {
        emoji = '🔄'; // Medium quality
    } else {
        emoji = emojis[Math.floor(Math.random() * emojis.length)]; // Good quality
    }
    
    imageDiv.textContent = emoji;
    imageGrid.appendChild(imageDiv);
    
    // Scroll to show new image
    imageDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Reset Training
function resetTraining() {
    stopTraining();
    
    currentEpoch = 0;
    generatorLoss = 2.5;
    discriminatorLoss = 0.7;
    lossHistory = { generator: [], discriminator: [] };
    trainingActive = false;
    
    // Reset button
    const btn = document.getElementById('start-training');
    const btnText = btn.querySelector('span');
    btnText.textContent = 'Start Training';
    btn.classList.remove('secondary-action');
    btn.classList.add('primary-action');
    btn.disabled = false;
    
    // Update status
    updateStatusBadge('ready', 'Ready');
    
    // Clear images
    document.getElementById('image-grid').innerHTML = '';
    document.getElementById('generation-message').style.display = 'flex';
    
    // Update display
    updateTrainingDisplay();
    drawChart();
}

// Update Display Values
function updateDisplayValues() {
    document.getElementById('lr-value').textContent = learningRate.toFixed(5);
    document.getElementById('noise-value').textContent = noiseDimension;
    updateTrainingDisplay();
}

// Show Component Information
function showComponentInfo(componentType) {
    const info = componentInfo[componentType];
    const infoPanel = document.getElementById('component-info');
    
    if (info) {
        infoPanel.innerHTML = `
            <div class="component-info-content" style="padding: 1rem;">
                <h3 style="color: var(--primary-600); margin-bottom: 1rem; font-size: 1.5rem;">${info.title}</h3>
                <div style="margin-bottom: 1.5rem;">
                    <strong style="color: var(--gray-900);">Description:</strong>
                    <p style="color: var(--gray-700); margin-top: 0.5rem; line-height: 1.7;">${info.description}</p>
                </div>
                <div>
                    <strong style="color: var(--gray-900);">Technical Details:</strong>
                    <p style="color: var(--gray-700); margin-top: 0.5rem; font-family: var(--font-mono); font-size: 0.9rem;">${info.technical}</p>
                </div>
            </div>
        `;
        
        // Highlight the clicked component
        document.querySelectorAll('.flow-card').forEach(comp => {
            comp.style.borderColor = '';
            comp.style.boxShadow = '';
        });
        const selected = document.querySelector(`[data-component="${componentType}"]`);
        if (selected) {
            selected.style.borderColor = 'var(--primary-500)';
            selected.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.2)';
        }
    }
}

// Switch Code Tabs
function switchTab(tabName) {
    // Remove active class from all tabs and panels
    document.querySelectorAll('.code-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.code-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    
    // Add active class to selected tab and panel
    const selectedTab = document.querySelector(`[data-tab="${tabName}"]`);
    const selectedPanel = document.getElementById(`${tabName}-tab`);
    
    if (selectedTab) selectedTab.classList.add('active');
    if (selectedPanel) selectedPanel.classList.add('active');
}

// Handle Window Resize
window.addEventListener('resize', () => {
    if (chartCanvas) {
        initializeChart();
    }
});

// Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
    // Space to start/pause training
    if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        toggleTraining();
    }
    
    // R to reset
    if (e.code === 'KeyR' && e.ctrlKey) {
        e.preventDefault();
        resetTraining();
    }
    
    // G to generate sample
    if (e.code === 'KeyG' && e.ctrlKey) {
        e.preventDefault();
        generateSample();
    }
});

// Console Easter Egg
console.log('%c🎨 GAN Interactive Demo', 'font-size: 20px; font-weight: bold; color: #6366f1;');
console.log('%cKeyboard Shortcuts:', 'font-size: 14px; font-weight: bold; margin-top: 10px;');
console.log('Space: Start/Pause Training');
console.log('Ctrl+R: Reset Training');
console.log('Ctrl+G: Generate Sample');
console.log('%c\nCreated by Prashanth Talwar for INFO 7390', 'font-style: italic; color: #8b5cf6;');