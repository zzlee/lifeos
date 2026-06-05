#!/bin/bash
set -e

echo "Installing lifeos CLI..."

cd "$(dirname "$0")/cli"
npm install
npm run build
npm link

echo "Successfully installed lifeos CLI!"
