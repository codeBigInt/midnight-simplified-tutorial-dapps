# **Tweet SocialFi — Midnight Blockchain dApp**
A privacy-preserving, SocialFi-powered micro-tweeting protocol built using the **Compact language** on the **Midnight blockchain**.  
This smart contract enables users to **create**, **update**, **promote**, **like**, **unlike**, **delete**, and **withdraw earnings from tweets** — all with built-in anonymity and economic incentives.

---

## **📌 Overview**
Tweet SocialFi is a decentralized micro-tweeting protocol where:

### ✔ Creators  
- Create tweets  
- Edit tweets  
- Promote their tweets  
- Earn tokens when their tweets gain enough likes  
- Withdraw earnings securely  
- Delete their tweets  

### ✔ Viewers  
- Like tweets (anonymously)  
- Unlike tweets  
- Pay small engagement fees  
- Support creators through economic engagement  

### ✔ Privacy  
This system uses:
- **Opaque data types**
- **Witness functions**
- **Sealed ledgers**
- **Merkle trees for anonymous liker tracking**
- **Private key-derived identities (not public addresses)**  

---

# **🔧 Contract Architecture**

### **Structures**
#### `Tweet`
Each tweet includes:
- `createdAt` – creation timestamp  
- `updateAt` – last update timestamp  
- `owner` – derived creator public key  
- `tweet` – tweet content  
- `likes` – engagement count  
- `promoted` – status flag  

---

## **📚 Ledger Variables**

| Ledger | Type | Description |
|--------|--------|-------------|
| `tweets` | `Map<Bytes<32>, Tweet>` | Stores tweet objects by ID |
| `likers` | `MerkleTree<100, Bytes<32>>` | Anonymous like commitments |
| `promotionPaymentCpk` | `ZswapCoinPublicKey` | Address for promotion funds |
| `likePaymentThreshold` | `Uint<128>` | Minimum likes before earnings withdrawal |

---

## **🔐 Witness Functions**

| Witness | Returns | Purpose |
|--------|----------|---------|
| `getCurrentTime()` | `Uint<64>` | Gets current timestamp |
| `findLiker(commitHash)` | `MerkleTreePath` | Validates whether a user liked a tweet |
| `getSecretKey()` | `Bytes<32>` | Used to generate private identities |

---

## **🧠 Core Features**

---

# **1️⃣ Create a Tweet**
```
createTweet(tweetId, tweet)
```
- Ensures the tweet ID is unique  
- Gets current timestamp  
- Derives creator public key  
- Stores the tweet  

---

# **2️⃣ Update a Tweet**
```
updateTweet(tweetId, newTweet)
```
- Checks existence  
- Verifies ownership  
- Updates tweet content and timestamp  

---

# **3️⃣ Delete a Tweet**
```
deleteTweet(tweetId)
```
- Only owner can delete  
- If the tweet has enough likes (`>= likePaymentThreshold`),  
  the creator receives earnings  
- Tweet is removed from storage  

Earnings formula:  
```
likes * 1_000_000 SPECKS
```

---

# **4️⃣ Promote a Tweet**
```
promoteTweet(tweetId, coin)
```
Users can promote their tweet by paying:  
```
expectedFee = 5_000_000 SPECKS
```
Funds are sent to the `promotionPaymentCpk`.

Promotion sets:
```
promoted = true
```

---

# **5️⃣ Withdraw Tweet Earnings**
```
withdrawTweetEarnings(tweetId)
```
- Requires tweet likes > threshold  
- Sends earnings to owner  
- Resets likes to zero  

---

# **6️⃣ Like a Tweet**
```
likeTweet(tweetId, coin)
```
- Checks tweet exists  
- Collects 1,000,000 SPECKS engagement fee  
- Inserts like commitment into Merkle tree  
- Increments like counter  

---

# **7️⃣ Unlike a Tweet**
```
unlikeTweet(tweetId)
```
- Generates user commitment  
- Verifies matching Merkle tree path  
- Refunds 1,000,000 SPECKS  
- Decrements like count  

---

# **8️⃣ Identity Generation**
```
generatePk(secret)
```
Generates a stable, private public key using:
- User `secret`
- Contract address (`kernel.self().bytes`)

This ensures:
- Each user has a unique identity per contract  
- Privacy is preserved (no global addresses)  

---

# **🪙 Token Logic**

### **Engagement Fees**
| Action | Fee |
|--------|--------|
| Like a tweet | 1 tDUST (1,000,000 SPECKS) |
| Promote tweet | 5 tDUST (5,000,000 SPECKS) |

### **Earnings Distribution**
Creators earn:
```
likes × 1 tDUST
```
Funds go directly to their public key.

---

# **🕸 Privacy Components**

### ✔ Anonymous Likes  
- Each like is stored as a Merkle commitment  
- Undoing a like requires proving membership (zero-knowledge)  
- Creator cannot deanonymize likers  

### ✔ Sealed Keys  
`promotionPaymentCpk` & `likePaymentThreshold` are sealed to ensure secure updates.

### ✔ Witness-based identity  
Secret key never touches the chain directly — privacy preserved.

---

# **🚀 Deployment**

Your constructor initializes:
```
promotionPaymentCpk = ownPublicKey()
likePaymentThreshold = 5
```

Meaning:
- Promotions go to the contract deployer by default  
- Minimum 5 likes required for earnings  

---

# **📦 Project Folder Structure (Recommended)**

```
/tweet-socialfi
|-- tweet-contract/
|-- src
|   |-- tweet.compact
|   |-- Helpers.compact
|   |-- CompactStandardLibrary.compact
|   |-- index.ts
|   |-- witness.ts
|   |-- deploy.ts
|   |-- userChoices.ts
|-- README.md
```

---

# **🧪 Testing Ideas**

You can build tests for:
- Creating tweets
- Unauthorized updates/deletes
- Liking/unliking operations
- Merkle membership verification
- Promotion payment path
- Withdrawal earnings
- Privacy of identities

---

# **🤝 Contributions**

Pull requests are welcome!  
Before contributing:
- Ensure your code follows Compact best practices  
- Write clean comments and explanations  
- Include reproducible test setups  

---

# **📜 License**
MIT License (or choose your own)

---

# **👏 Acknowledgements**
This project uses:
- **Midnight Compact Language**
- **Compact Standard Library**
- **Merkle Tree Privacy**
- **Zswap Token Mechanisms**
