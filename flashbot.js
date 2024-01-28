const { providers, Wallet, utils, BigNumber, ethers } = require("ethers")
const {
  FlashbotsBundleProvider,
  FlashbotsBundleResolution,
} = require("@flashbots/ethers-provider-bundle")
const { exit } = require("process")
const yesno = require("yesno")


const provider = new providers.JsonRpcProvider('https://rpc.ankr.com/eth')
const RELAY = "https://relay.flashbots.net"
const KEY_OWNER = "0x...PrivaateKey"
const KEY_KORBAN = "0x...PrivaateKey"
const CLAIMABLE_TOKEN = "200"


const TOKEN_TRANSFER = {
  contract: "0x...Address",
  data: "0x..Dataadsada"
}
const DISTRIBUTOR = {
  contract: "0x...Address",
  data: "0x..Dataadsada"
}

const owner = new Wallet(KEY_OWNER).connect(provider)
const korban = new Wallet(KEY_KORBAN).connect(provider)



function calculateFee(tx) {
  return utils.formatEther(tx.maxFeePerGas) * parseInt(tx.gasLimit)

}

const main = async () => {


  const authSigner = Wallet.createRandom()

  const flashbotsProvider = await FlashbotsBundleProvider.create(
    provider,
    authSigner,
    RELAY,
    // 'sepolia'
  )

  const abi = ["function transfer(address,uint256) external"]
  const iface = new utils.Interface(abi)


  async function transferFee(ind, val) {
    if (ind) {
      let tx = await owner.populateTransaction({
        to: korban.address,
        value: utils.parseEther(val)
      })

      return tx

    } else {
      let tx = await owner.populateTransaction({
        to: korban.address,
        value: utils.parseEther("0")
      })

      return tx
    }
  }
  async function claim() {
    let tx = await korban.populateTransaction({
      to: DISTRIBUTOR.contract,
      value: utils.parseEther("0"),
      data: DISTRIBUTOR.data
    })

    return tx
  }
  async function transferToken() {
    let tx = await korban.populateTransaction({
      to: TOKEN_TRANSFER.contract,
      value: utils.parseEther("0"),
      data: iface.encodeFunctionData("transfer", [
        owner.address,
        utils.parseEther(CLAIMABLE_TOKEN),
      ])
    })

    return tx
  }



  let fee = []
  await transferFee().then((x) => {
    fee.push({
      action: "transferFee",
      value: calculateFee(x),
      tx: x
    })
  })
  await claim().then((x) => {
    fee.push({
      action: "claim",
      value: calculateFee(x),
      tx: x
    })
  })
  await transferToken().then((x) => {
    fee.push({
      action: "transferToken",
      value: calculateFee(x),
      tx: x
    })
  })

  let sum = 0

  for (let i = 0; i < fee.length; i++) {

    sum += fee[i].value
  }

  let feeToSent = fee[0].value + fee[1].value + fee[2].value

  const update = await transferFee(true, feeToSent)
  fee[0] = update

  console.log(`\n######## DETAIL TOTAL FEE ###### \n`)
  fee.map((v) => {
    console.log(`${v.action}: ${v.value} ETH`)
  })
  console.log(`Total Fee: ${sum} ETH`)
  const signedTransactions = await flashbotsProvider.signBundle([
    {
      signer: owner,
      transaction: fee[0].tx
    },
    {
      signer: korban,
      transaction: fee[1].tx
    },
    {
      signer: korban,
      transaction: fee[2].tx
    },
  ])

  const ok = await yesno({
    question: 'Lanjut proses? y/n'
  })

  if (ok) {
    run()
  }

  async function run(params) {
    provider.on("block", async (blockNumber) => {
      console.log(`Sedang Mencari Block... \nBlock saat ini: ${blockNumber}`)
      const targetBlockNumber = blockNumber + 1




      const bundleSubmission = await flashbotsProvider.sendRawBundle(
        signedTransactions,
        targetBlockNumber
      )

      if ("error" in bundleSubmission) {
        console.log(bundleSubmission.error.message)
        return
      }

      const resolution = await bundleSubmission.wait()
      if (resolution === FlashbotsBundleResolution.BundleIncluded) {
        console.log("######################################################")
        console.log(
          `Transaksi Sukses!!, Transaksi di eksekusi di Block: ${targetBlockNumber}`
        )
        bundleSubmission.bundleTransactions.map((asd) => {
          console.log(`Tx Hash: \nhttps://etherscan.io/tx/${asd.hash}`)
        })
        exit(0)
      } else if (
        resolution === FlashbotsBundleResolution.BlockPassedWithoutInclusion
      ) {
        console.log(
          `Transaksi gk ke eksekusi di block: ${targetBlockNumber} \nMencari blok lain...\n`
        )
      } else if (resolution === FlashbotsBundleResolution.AccountNonceTooHigh) {
        console.log("Nonce Ketinggian, Hmm..")
        exit(1)
      }

    })
  }

}

main()
