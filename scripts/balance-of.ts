import { ethers, network } from 'hardhat'
import { encryptDataField, decryptNodeResponse } from '@swisstronik/utils'
import { HttpNetworkConfig } from 'hardhat/types'
import deployedAddress from '../utils/deployed-address'
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'
import { TransactionRequest } from 'ethers'

const sendShieldedQuery = async (wallet: HardhatEthersSigner, destination: string, data: string) => {
  if (!wallet.provider) {
    throw new Error("wallet doesn't contain connected provider")
  }

  const rpclink = (network.config as HttpNetworkConfig).url
  const [encryptedData, usedEncryptedKey] = await encryptDataField(rpclink, data)

  const networkInfo = await wallet.provider.getNetwork()
  const nonce = await wallet.getNonce()

  console.log(networkInfo)

  const callData = {
    to: destination,
    data: encryptedData,
    nonce: nonce,
    chainId: 1291,
    gasLimit: 200000,
    gasPrice: 0,
  } as TransactionRequest

  const signedRawCallData = await wallet.signTransaction(callData)
  console.log('nyampe')
  const decoded = ethers.Transaction.from(signedRawCallData)

  const signedCallData = {
    nonce: nonce,
    to: decoded.to,
    data: decoded.data,
    chainId: ethers.toBeHex(1291),
  }

  const response = await wallet.provider.call(signedCallData)

  return await decryptNodeResponse(rpclink, response, usedEncryptedKey)
}

async function main() {
  const contractAddress = deployedAddress
  const [signer] = await ethers.getSigners()

  const contractFactory = await ethers.getContractFactory('PERC20Sample')
  const contract = contractFactory.attach(contractAddress)

  const functionName = 'balanceOf'
  const functionArgs = [signer.address]
  const responseMessage = await sendShieldedQuery(
    signer,
    contractAddress,
    contract.interface.encodeFunctionData(functionName, functionArgs)
  )
  const totalBalance = contract.interface.decodeFunctionResult(functionName, responseMessage)[0]

  console.log('Total Balance is:', ethers.formatUnits(totalBalance, 18), 'Token')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
