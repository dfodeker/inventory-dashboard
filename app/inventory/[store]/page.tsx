import { newColumns } from "@/app/payments/columns";
import { AltTable, NewDataTable } from "@/app/payments/data-table";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { File } from "@/app/payments/columns";
// TODO: move base url to env local and remote
export const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:8787";
interface Props {
  params: { store: string };
}

export interface InventoryItem {
  customMetadata: Record<string, unknown>; // a dictionary, because who knows what's in there
  httpMetadata: {
    contentType: string;
  };
  uploaded: string; // date as a string, seriously?
  checksums: {
    md5: string;
  };
  httpEtag: string;
  etag: string;
  size: number;
  version: string;
  key: string;
}

export interface InventoryResponse {
  objects: InventoryItem[]; // an array of InventoryItems, rocket science
  truncated: boolean; // true or false, wow
  delimitedPrefixes: string[]; // another array, you're on a roll
}

export function formatDate(date: Date) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0"); // Remember, months are 0-based
  const yyyy = date.getFullYear();
  return `${dd}-${mm}`;
}
export default async function Inventory({ params: { store } }: Props) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const todayDayandMonth = formatDate(today);
 
  const yesterdayDayandMonth = formatDate(yesterday);
  const newData = await getMostRecentFiles(
    store,
    todayDayandMonth,
    yesterdayDayandMonth
  );

  
  const groupedData = groupFilesByHour(newData);
  // const checker = groupedData.map((group, index) => {
  //  // console.log(group.files);
  //  // console.log(group.timeRange);
  //   console.log(index)
  // });
  // Now let's render this like we're not stuck in the 90s
  ///inventory/${store}/batches/${item.key}
  return (
    <>
      <div className="m-4">
        <div className="grid gap-4 md:grid-cols-[auto_min-content] lg:grid-cols-[auto_min-content]">
          <h1 className="text-xl font-bold mb-4">
            Latest Inventory Mutations at {store.toUpperCase()}
          </h1>
          <div className="justify-self-end">
            <Link href={`${store}/totals`} className={buttonVariants({ variant: "default" })}>
              View Mutation History
            </Link>
          </div>
        </div>
   {
      groupedData.length === 0 ? < AltTable columns={newColumns} data={newData} /> : null
   }

        {groupedData.map((group, index) => (
          
  <div key={`${group.timeRange}-${index}`} className="mb-5"> 
    <h2 className="text-lg font-bold mb-2">
      {group.timeRange.replace('-', ' to ')} batch  - {group.count} mutation(s)
    </h2>
    {
      group.files.length > 0 ? <AltTable columns={newColumns} data={group.files} /> : <p>No mutations in this batch</p>
    }
  </div>
))}
       
      </div>
    </>
  );
}

// { 
//   group.files.length === 0 ?<NewDataTable columns={newColumns} data={group.files} />: <section className="mt-5 mb-10">
// <NewDataTable columns={newColumns} data={[]} />
// </section>
// }
{/* <section className="mt-5 mb-10">
          <NewDataTable columns={newColumns} data={newData} />
        </section> */}

export async function getMostRecentFiles(
  store: string,
  today: string,
  yesterday: string
) {
console.log(today);
  let attempts = [
    `${baseUrl}/${store}-inventory-update-${today}`, 
    `${baseUrl}/${store}-inventory-update-${yesterday}`, 
  ];

  for (let url of attempts) {
    try {
      const response = await fetch(`${url}?limit=1000`, {
        cache: "no-store",
        headers: {
          Authorization: process.env.INVENTORY_API_TOKEN || "", 
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        throw new Error(`Failed request with status: ${response.status}`); 
      }

      const data = await response.json();
     // console.log(data.objects.length);
     
      if (data.objects && data.objects.length > 0) {
        return data.objects; 
      }
      
      console.warn("Received empty data.objects, requesting from the previous day..."); 
    } catch (e) {
      console.error("Fetching or parsing failed", e);
     
      throw new Error("No data after retries. Check logs for details.");
    }
  }
  return []; // if you're here, there was no data today and yessterday
}

type GroupedFiles = {
    timeRange: string;
    files: File[];
    count: number;
  };
  export function groupFilesByHour(files: File[]): GroupedFiles[] {
    const grouped = files.reduce((acc: { [key: string]: { files: File[]; count: number } }, file: File) => {
        const date = new Date(file.uploaded);
        
        // Convert to CST
        const options = { timeZone: 'America/Chicago', hour12: false };
        const cstDateString = date.toLocaleString('en-US', options);
        const cstDate = new Date(cstDateString);
      console.log(cstDate);
        const hour = cstDate.getHours();
        const startHour = hour % 12 || 12; // Convert to 12-hour format, using 12 instead of 0
        const endHour = (hour + 1) % 12 || 12; // Convert to 12-hour format, using 12 instead of 0
        const ampmStart = hour >= 12 ? "PM" : "AM";
        const ampmEnd = (hour + 1) >= 12 ? "PM" : "AM";
        const key = `${startHour} ${ampmStart}-${endHour} ${ampmEnd}`;

        if (!acc[key]) {
            acc[key] = { files: [], count: 0 };
        }

        acc[key].files.push(file);
        acc[key].count++;

        return acc;
    }, {});

    return Object.entries(grouped).map(([timeRange, { files, count }]) => ({
        timeRange,
        files,
        count,
    }));
}