// =================================================================
// ARQUIVO: generate-session.js
// DESCRIÇÃO: Script ÚNICO para gerar e empacotar a string de sessão para o Render.
// USO:
// 1. Delete a pasta 'auth_info_multi' se ela existir.
// 2. Execute o bot localmente com `npm run dev`.
// 3. Escaneie o QR Code e espere a mensagem "BOT CONECTADO".
// 4. Pare o bot (Ctrl+C).
// 5. Execute `npm run session`.
// 6. Copie o bloco de texto gerado e cole nas variáveis de ambiente no Render.
// =================================================================
 
import { promises as fs } from 'fs';
import path from 'path';
import { BufferJSON } from '@whiskeysockets/baileys';

const AUTH_DIR = 'auth_info_multi';

async function generateSessionString() {
  const outputFilePath = path.resolve('session_for_render.txt'); // Novo arquivo de saída
  try {
    console.log('▶️  Lendo arquivos de sessão da pasta:', AUTH_DIR);
    const files = await fs.readdir(AUTH_DIR);
    const credsFile = files.find(file => file === 'creds.json');

    if (!credsFile) {
      throw new Error('Arquivo "creds.json" não encontrado na pasta "auth_info_multi". Certifique-se de que o bot foi iniciado e o QR Code escaneado com sucesso antes de executar este script.');
    }

    const creds = JSON.parse(await fs.readFile(path.join(AUTH_DIR, credsFile), 'utf-8'), BufferJSON.reviver);

    const keys = {};
    for (const file of files) {
      if (file !== 'creds.json') {
        const filePath = path.join(AUTH_DIR, file);
        const data = JSON.parse(await fs.readFile(filePath, 'utf-8'), BufferJSON.reviver);
        
        // O nome do arquivo é a chave (ex: 'pre-key-1'), e o conteúdo é o valor
        const key = file.replace('.json', '');
        keys[key] = data;
      }
    }

    const sessionData = { creds, keys };
    // Gera a string JSON sem espaços ou quebras de linha (minificada) para evitar erros de cópia.
    const sessionString = JSON.stringify(sessionData, BufferJSON.replacer);

    // Salva a string no arquivo .env
    const envContentForRender = `SESSION_DATA=${sessionString}`;
    await fs.writeFile(outputFilePath, envContentForRender);

    console.log('\n✅ Sessão gerada e empacotada com sucesso!');
    console.log(`   A sessão foi salva no arquivo: ${outputFilePath}`);
    console.log('\n🚀 PRÓXIMO PASSO:');
    console.log('   1. Abra o arquivo "session_for_render.txt" que foi criado na pasta do projeto.');
    console.log('   2. Copie TODO o conteúdo desse arquivo.');
    console.log('   3. Cole o conteúdo na seção "Environment" do seu serviço no Render (use a opção "Bulk Edit").');

  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error('❌ Erro: O diretório "%s" não foi encontrado.', AUTH_DIR);
      console.error('   Certifique-se de iniciar o bot (`npm run dev`) e escanear o QR Code primeiro.');
    } else {
      console.error('❌ Erro ao gerar a string de sessão:', error.message);
    }
  }
}

generateSessionString();