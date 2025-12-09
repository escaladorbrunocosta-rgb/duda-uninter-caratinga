#!/bin/bash

# Faz o script parar se um comando falhar
set -e

# Script para iniciar o duda-uninter-bot de forma robusta
# Garante que as dependências estão instaladas e inicia o bot com logs claros.

echo "============================================="
echo "🚀 Iniciando o Duda Uninter Bot..."
echo "============================================="

# echo -e "\n[1/3] Limpando o cache do npm para evitar erros..."
# npm run clean

echo -e "\n[2/3] Verificando e instalando dependências..."
npm install

echo -e "\n[3/3] Iniciando o bot em modo de desenvolvimento..."
echo "Pressione CTRL+C para parar o bot."
echo "---------------------------------------------"

npm run dev