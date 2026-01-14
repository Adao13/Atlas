
# ATLAS: Infraestrutura para Autonomia e Crise

O ATLAS é um sistema de suporte à vida digital projetado para resiliência extrema.

## Protocolo de SOS (V2 - Strict Enforcement)

Diferente de sistemas convencionais, o sinal de SOS no ATLAS segue uma lógica de "Vigilância de Rede":

1. **Ativação Irrevogável:** Uma vez ativado pelo nó em perigo, o usuário local não pode cancelar o sinal. Isso previne que agressores forcem a vítima a desligar o pedido de socorro.
2. **Confirmação Externa:** O sinal só é marcado como 'RESOLVED' quando um nó receptor próximo atua fisicamente no local e confirma a segurança da vítima via protocolo de proximidade.
3. **Escalonamento por Inatividade (10min):** Se nenhum nó receptor confirmar a resolução em 10 minutos, o sistema assume que os nós próximos estão comprometidos ou incapazes. O sinal é automaticamente amplificado para todas as frequências disponíveis (LoRa, Mesh Distante, Bluetooth LE), ignorando filtros de privacidade para garantir a sobrevivência.

## Pilares
- **Resiliência:** Malha P2P sem dependência de internet.
- **Segurança:** Criptografia de ponta a ponta com identidades soberanas.
- **Educação:** Biblioteca offline replicada via Gossip.
