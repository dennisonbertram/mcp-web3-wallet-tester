#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Change to the script directory
cd "$SCRIPT_DIR"

# Default values
START_ANVIL=false
MCP_PORT=3001
WS_PORT=8546
CHAIN_ID=""
ANVIL_PID=""

# Parse command line arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --anvil) START_ANVIL=true ;;
        --port=*) MCP_PORT="${1#*=}" ;;
        --ws-port=*) WS_PORT="${1#*=}" ;;
        --chain-id=*) CHAIN_ID="${1#*=}" ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --anvil           Start Anvil in the background"
            echo "  --port=NNNN       Override MCP port (default: 3001)"
            echo "  --ws-port=NNNN    Override WebSocket port (default: 8546)"
            echo "  --chain-id=N      Set chain ID (useful for mainnet forks)"
            echo "  -h, --help        Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                           # Start server with defaults"
            echo "  $0 --anvil                   # Start server and Anvil"
            echo "  $0 --port=4000 --anvil       # Custom port with Anvil"
            echo "  $0 --chain-id=1 --anvil      # Mainnet fork"
            exit 0
            ;;
        *) echo "Unknown parameter: $1"; echo "Use --help for usage information"; exit 1 ;;
    esac
    shift
done

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "Failed to install dependencies"
        exit 1
    fi
else
    echo "Dependencies already installed"
fi

# Check if dist directory exists and is up to date
if [ ! -d "dist" ] || [ "src" -nt "dist" ]; then
    echo "Building project..."
    npm run build
    if [ $? -ne 0 ]; then
        echo "Build failed"
        exit 1
    fi
else
    echo "Build is up to date"
fi

# Cleanup function for graceful shutdown
cleanup() {
    echo ""
    echo "Shutting down..."
    if [ -n "$ANVIL_PID" ]; then
        echo "Stopping Anvil (PID: $ANVIL_PID)..."
        kill $ANVIL_PID 2>/dev/null
        wait $ANVIL_PID 2>/dev/null
    fi
    exit 0
}

# Set up trap for cleanup
trap cleanup SIGINT SIGTERM

# Start Anvil if requested
if [ "$START_ANVIL" = true ]; then
    # Check if anvil is available
    if ! command -v anvil &> /dev/null; then
        echo "Error: anvil command not found. Please install Foundry:"
        echo "  curl -L https://foundry.paradigm.xyz | bash"
        echo "  foundryup"
        exit 1
    fi

    echo "Starting Anvil..."
    if [ -n "$CHAIN_ID" ]; then
        anvil --chain-id "$CHAIN_ID" &
        ANVIL_PID=$!
        echo "Anvil started with chain ID $CHAIN_ID (PID: $ANVIL_PID)"
    else
        anvil &
        ANVIL_PID=$!
        echo "Anvil started with default chain ID 31337 (PID: $ANVIL_PID)"
    fi

    # Wait a moment for Anvil to start
    echo "Waiting for Anvil to initialize..."
    sleep 2
fi

# Set environment variables
export MCP_PORT=$MCP_PORT
export WS_PORT=$WS_PORT
if [ -n "$CHAIN_ID" ]; then
    export CHAIN_ID=$CHAIN_ID
fi

# Start the server
echo ""
echo "Starting MCP Web3 Wallet Tester..."
echo "MCP Port: $MCP_PORT"
echo "WebSocket Port: $WS_PORT"
if [ -n "$CHAIN_ID" ]; then
    echo "Chain ID: $CHAIN_ID"
fi
echo ""

npm start

# If we reach here, the server has stopped
cleanup
