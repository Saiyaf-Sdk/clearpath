# University logos

Put each university's **official** logo here, named by its portal address (the `slug` in `../universities.js`):

| File | University |
| --- | --- |
| `colombo.png` | University of Colombo |
| `peradeniya.png` | University of Peradeniya |
| `sjp.png` | University of Sri Jayewardenepura |
| `kelaniya.png` | University of Kelaniya |
| `moratuwa.png` | University of Moratuwa |
| `jaffna.png` | University of Jaffna |
| `ruhuna.png` | University of Ruhuna |
| `eastern.png` | Eastern University, Sri Lanka |
| `south-eastern.png` | South Eastern University of Sri Lanka |
| `rajarata.png` | Rajarata University of Sri Lanka |
| `sabaragamuwa.png` | Sabaragamuwa University of Sri Lanka |
| `wayamba.png` | Wayamba University of Sri Lanka |
| `uva-wellassa.png` | Uva Wellassa University |
| `uvpa.png` | University of the Visual and Performing Arts |
| `ousl.png` | The Open University of Sri Lanka |
| `gwuim.png` | Gampaha Wickramarachchi University of Indigenous Medicine |
| `vavuniya.png` | University of Vavuniya |

- PNG is best (transparent background, square; these are 384 × 384, which stays sharp up to the largest size the app shows). JPG, WebP and SVG also work, but only PNG and JPG appear on the PDF certificate.
- The server applies these on start, and `npm run seed` / `npm run reset` apply them too. Restart the server after adding or replacing a file.
- A logo uploaded in the app (platform admin → Universities, or the university admin → Account settings) takes priority. Removing that upload brings this file back.
- These logos belong to the universities. Use the files they publish and do not alter them.
